import AgoraRTC from 'agora-rtc-sdk'
import EventEmitter from 'events'
AgoraRTC.Logger.disableLogUpload()
AgoraRTC.Logger.setLogLevel(0)
const appId = '9d8b280958bd4a2ea4db2364605954e7'
class AgoraController extends EventEmitter {
  constructor () {
    super()
    this.audioInputDevice = 'default'
    this.audioOutputDevice = 'default'
    this.joined = false
    this.published = false
    this.localStream = null
    this.remoteStreams = []
    this.createdElememts = []
    this.localSoundTrack = null
    this.getRemoteAudio = false
    this.params = {}
    this.currentChannel = ''
    this.uid = 0
    this.targetUid = 0
    this.timeout = null
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'h264' })
    this.client.init(appId, function () {
      console.log('init success')
    }, (err) => {
      this.errored = true
      console.error(err)
    })
    this.client.on('stream-added', (evt) => {
      this.remoteStreams.push(evt.stream)
      var remoteStream = evt.stream
      var id = remoteStream.getId()
      console.log(id)
      if (id === this.targetUid) {
        this.client.subscribe(remoteStream, function (err) {
          this.emit('stream-suscribe-failed')
          console.log('stream subscribe failed', err)
        })
      } else if (id === this.uid) {} else {
        this.emit('threaten', 'stream-added', id)
      }
      this.emit('stream-added', evt)
      console.log('stream-added remote-uid: ', id)
    })
    this.client.on('stream-subscribed', (evt) => {
      var remoteStream = evt.stream
      if (remoteStream.hasAudio()) {
        this.getRemoteAudio = true
        remoteStream.muteVideo()
        this.playStream(remoteStream)
      }
      var id = remoteStream.getId()
      this.remoteStreams.push(remoteStream)
      this.emit('stream-subscribed', evt)
      console.log('stream-subscribed remote-uid: ', id)
    })
    this.client.on('stream-updated', (evt) => {
      if (evt.stream.id === this.targetUid) {
        if (!this.getRemoteAudio && evt.stream.hasAudio()) {
          this.getRemoteAudio = true
          this.playStream(evt.stream)
        }
      }
    })

    this.client.on('stream-removed', function (evt) {
      var remoteStream = evt.stream
      var id = remoteStream.getId()
      this.stopStream(remoteStream)
      this.emit('stream-removed')
      // Remove the view of the remote stream.
      console.log('stream-removed remote-uid: ', id)
    })
    this.client.on('connected', () => {
      this.emit('connected')
      if (this.localSoundTrack == null) {
        this.createLocalInputTrack().then(() => {
          return this.createLocalStream()
        }).then(() => {
          return this.initLocalStream()
        }).then(() => {
          return this.publish()
        })
      }
    })
    this.client.on('peer-leave', (evt) => {
      if (evt.uid === this.targetUid) {
        this.emit('peer-leave')
      }
    })
    this.client.on('peer-online', (evt) => {
      if (evt.uid === this.targetUid) {
        this.emit('peer-online')
      }
    })
    this.client.on('connection-state-change', (evt) => {
      if (evt.curState === 'DISCONNECTED') {
        this.emit('disconnected')
      }
    })
  }

  join (channel, uid, targetUid, timeout = 10000) {
    if (this.joined) {
      throw (new Error('Already Joined'))
    } else {
      this.uid = uid
      this.getRemoteAudio = false
      this.targetUid = targetUid
      this.currentChannel = channel
      this.timeout = setTimeout(() => {
        debugger
        if (this.joined && this.published && this.getRemoteAudio) {} else {
          this.leave()
          this.emit('timeout')
        }
        this.timeout = null
      }, timeout)
      return new Promise((resolve, reject) => {
        this.client.join(null, channel, '' + parseInt(this.uid), (...args) => {
          this.joined = true
          this.remoteStreams = []
          resolve(...args)
        }, reject)
      })
    }
  }

  leave () {
    clearTimeout(this.timeout)
    this.timeout = null
    return new Promise((resolve, reject) => {
      this.client.leave((...args) => {
        this.cleanUp()
        resolve(...args)
      }, reject)
    })
  }

  publish () {
    this.published = true
    this.client.publish(this.localStream, (err) => {
      this.published = false
      console.log(err)
    })
  }

  getDevices () {
    return navigator.mediaDevices.enumerateDevices()
  }

  cleanUp () {
    this.joined = false
    this.published = false
    this.remoteStreams.forEach(stream => { this.stopStream(stream) })
    this.remoteStreams = []

    try {
      this.localStream.stop()
      this.localStream.close()
    } catch (error) {
      console.log(error)
    } finally {
      this.localStream = null
    }

    try {
      this.localSoundTrack.stop()
    } catch (error) {
      console.log(error)
    } finally {
      this.localSoundTrack = null
    }

    this.targetUid = 0
    this.currentChannel = ''
    this.getRemoteAudio = false
    this.createdElememts.forEach((e) => { e.remove() })
    this.createdElememts = []
  }

  async createLocalStream () {
    this.localStream = AgoraRTC.createStream({
      streamID: this.uid,
      video: false,
      audio: true,
      screen: false,
      audioSource: this.localSoundTrack
    })
    return this.localStream
  }

  async initLocalStream () {
    return new Promise((resolve, reject) => {
      this.localStream.init(resolve, reject)
    })
  }

  async createLocalInputTrack () {
    this.localSoundTrack = (await navigator.mediaDevices.getUserMedia({ video: false, audio: { deviceId: this.audioInputDevice } })).getAudioTracks()[0]
    return true
  }

  playStream (stream) {
    var id = stream.getId()
    var element = document.createElement('video')
    element.id = 'remote_video_' + id
    element.srcObject = new MediaStream([stream.getAudioTrack()])
    element.setSinkId(this.audioOutputDevice).then(() => {
      console.log('Set Devices Success')
      element.play().then((...args) => {
        console.log(...args)
        this.emit('connectedToRemote')
      }).catch((...args) => {
        this.emit('playError', ...args)
      })
    }).catch(() => {
      element.play().then((...args) => {
        console.log(...args)
        this.emit('connectedToRemote')
      }).catch((...args) => {
        this.emit('playError', ...args)
      })
    })

    this.createdElememts.push(element)
  }

  stopStream (stream) {
    var id = stream.getId()
    var element = document.getElementById('remote_video_' + id)
    if (element) {
      element.remove()
    }
  }
}
if (window.agoraController === undefined) {
  window.agoraController = new AgoraController()
}

export default {
  install (Vue) {
    Vue.prototype.$agora = window.agoraController
  }
}
