import { useRef, useCallback, useState, useEffect } from 'react'

/**
 * Custom hook for managing Web Audio API playback.
 * Handles AudioContext creation, source node lifecycle,
 * playback timing, and real-time position tracking.
 */
export function useAudioPlayback(audioBuffer) {
    const audioContextRef = useRef(null)
    const sourceNodeRef = useRef(null)
    const startTimeRef = useRef(0)
    const startOffsetRef = useRef(0)
    const scheduledEndRef = useRef(null)
    const rafRef = useRef(null)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [playbackMode, setPlaybackMode] = useState(null) // 'full' | 'selected'

    const getAudioContext = useCallback(() => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume()
        }
        return audioContextRef.current
    }, [])

    const stopSource = useCallback(() => {
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop() } catch (e) { /* already stopped */ }
            sourceNodeRef.current.disconnect()
            sourceNodeRef.current = null
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
        }
        if (scheduledEndRef.current) {
            clearTimeout(scheduledEndRef.current)
            scheduledEndRef.current = null
        }
    }, [])

    const updateTime = useCallback(() => {
        if (!audioContextRef.current || !isPlaying) return
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current
        setCurrentTime(startOffsetRef.current + elapsed)
        rafRef.current = requestAnimationFrame(updateTime)
    }, [isPlaying])

    useEffect(() => {
        if (isPlaying) {
            rafRef.current = requestAnimationFrame(updateTime)
        }
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [isPlaying, updateTime])

    const playFull = useCallback(() => {
        if (!audioBuffer) return
        stopSource()
        const ctx = getAudioContext()
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        source.onended = () => {
            setIsPlaying(false)
            setPlaybackMode(null)
            setCurrentTime(0)
        }
        startTimeRef.current = ctx.currentTime
        startOffsetRef.current = 0
        source.start(0, 0)
        sourceNodeRef.current = source
        setIsPlaying(true)
        setPlaybackMode('full')
        setCurrentTime(0)
    }, [audioBuffer, getAudioContext, stopSource])

    const playSelected = useCallback((start, duration) => {
        if (!audioBuffer) return
        stopSource()
        const ctx = getAudioContext()
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        source.onended = () => {
            setIsPlaying(false)
            setPlaybackMode(null)
            setCurrentTime(start)
        }
        startTimeRef.current = ctx.currentTime
        startOffsetRef.current = start
        source.start(0, start, duration)
        sourceNodeRef.current = source
        setIsPlaying(true)
        setPlaybackMode('selected')
        setCurrentTime(start)

        // Safety timeout — stop after duration in case onended doesn't fire reliably
        scheduledEndRef.current = setTimeout(() => {
            stopSource()
            setIsPlaying(false)
            setPlaybackMode(null)
            setCurrentTime(start)
        }, duration * 1000 + 100)
    }, [audioBuffer, getAudioContext, stopSource])

    const pause = useCallback(() => {
        stopSource()
        setIsPlaying(false)
        setPlaybackMode(null)
    }, [stopSource])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopSource()
            if (audioContextRef.current) {
                audioContextRef.current.close()
            }
        }
    }, [stopSource])

    return {
        isPlaying,
        currentTime,
        playbackMode,
        playFull,
        playSelected,
        pause,
        setCurrentTime,
    }
}
