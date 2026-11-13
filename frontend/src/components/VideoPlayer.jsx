import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

const VideoPlayer = forwardRef(({ videoId, onTimeUpdate }, ref) => {
  const playerRef = useRef(null)
  const intervalRef = useRef(null)
  const containerId = 'youtube-iframe-player'

  // Expose seekTo method to parent component
  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(seconds, true)
        // Also ensure video plays after seeking
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo()
        }
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        return playerRef.current.getCurrentTime()
      }
      return 0
    },
  }))

  useEffect(() => {
    if (!videoId) return

    let playerInstance = null

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return

      // Destroy previous instance if it exists
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy()
      }

      playerInstance = new window.YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target
            // Poll current playback time every 500ms
            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = setInterval(() => {
              if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                const sec = playerRef.current.getCurrentTime()
                if (onTimeUpdate) {
                  onTimeUpdate(Math.round(sec * 10) / 10)
                }
              }
            }, 500)
          },
        },
      })
    }

    if (window.YT && window.YT.Player) {
      initPlayer()
    } else {
      // Wait for YouTube API script to finish loading
      window.onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy()
        } catch (e) {
          // ignore cleanup errors on fast remounts
        }
      }
    }
  }, [videoId])

  return (
    <div className="player-wrapper">
      <div id={containerId} />
    </div>
  )
})

export default VideoPlayer
