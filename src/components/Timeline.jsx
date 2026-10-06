import { useRef, useEffect, useMemo, useCallback } from 'react'

/**
 * Timeline renders a canvas-based waveform + time markers.
 * The waveform is drawn once and cached; only the playback indicator
 * and selection overlays are composited on top.
 */
export default function Timeline({
    audioBuffer,
    audioDuration,
    selectedStart,
    onSelectionChange,
    currentTime,
    isPlaying,
    renderSelection,
    trimDuration = 30,
}) {
    const containerRef = useRef(null)
    const canvasRef = useRef(null)
    const waveformCacheRef = useRef(null)

    // Generate time markers
    const markers = useMemo(() => {
        if (!audioDuration) return []
        const result = []
        const interval = audioDuration <= 60 ? 5 : audioDuration <= 300 ? 10 : 30
        for (let t = 0; t <= audioDuration; t += interval) {
            result.push({
                time: t,
                label: formatTime(t),
                isMajor: t % 30 === 0,
                position: (t / audioDuration) * 100,
            })
        }
        return result
    }, [audioDuration])

    // Draw waveform
    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas || !audioBuffer) return

        const container = containerRef.current
        const dpr = window.devicePixelRatio || 1
        const width = container.clientWidth
        const height = 120

        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'

        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)

        // Background
        ctx.fillStyle = 'rgba(12, 16, 32, 0.5)'
        ctx.fillRect(0, 0, width, height)

        // Draw waveform from channel data
        const channelData = audioBuffer.getChannelData(0)
        const samples = channelData.length
        const step = Math.ceil(samples / width)
        const mid = height / 2

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height)
        gradient.addColorStop(0, 'rgba(162, 155, 254, 0.8)')
        gradient.addColorStop(0.5, 'rgba(108, 92, 231, 0.9)')
        gradient.addColorStop(1, 'rgba(162, 155, 254, 0.8)')

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(0, mid)

        // Top half
        for (let i = 0; i < width; i++) {
            let max = 0
            const start = i * step
            const end = Math.min(start + step, samples)
            for (let j = start; j < end; j++) {
                const abs = Math.abs(channelData[j])
                if (abs > max) max = abs
            }
            const y = mid - max * mid * 0.85
            ctx.lineTo(i, y)
        }

        // Bottom half (mirror)
        for (let i = width - 1; i >= 0; i--) {
            let max = 0
            const start = i * step
            const end = Math.min(start + step, samples)
            for (let j = start; j < end; j++) {
                const abs = Math.abs(channelData[j])
                if (abs > max) max = abs
            }
            const y = mid + max * mid * 0.85
            ctx.lineTo(i, y)
        }

        ctx.closePath()
        ctx.fill()

        // Center line
        ctx.strokeStyle = 'rgba(108, 92, 231, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, mid)
        ctx.lineTo(width, mid)
        ctx.stroke()

        // Cache the waveform image
        waveformCacheRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }, [audioBuffer])

    useEffect(() => {
        drawWaveform()
        const handleResize = () => drawWaveform()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [drawWaveform])

    // Playback indicator position
    const playbackPosition = useMemo(() => {
        if (!audioDuration || !isPlaying) return null
        return (currentTime / audioDuration) * 100
    }, [currentTime, audioDuration, isPlaying])

    // Selection overlay positions — clamped to [0, 100]
    const selectionLeft = useMemo(() => {
        if (!audioDuration) return 0
        const clampedStart = Math.max(0, Math.min(selectedStart, audioDuration))
        return (clampedStart / audioDuration) * 100
    }, [selectedStart, audioDuration])

    const selectionWidth = useMemo(() => {
        if (!audioDuration || !trimDuration) return 0
        const clampedStart = Math.max(0, Math.min(selectedStart, audioDuration))
        const effectiveDuration = Math.min(trimDuration, audioDuration - clampedStart)
        return Math.max(0, (effectiveDuration / audioDuration) * 100)
    }, [audioDuration, trimDuration, selectedStart])

    // Handle click on timeline to move selection
    const handleTimelineClick = useCallback((e) => {
        if (!containerRef.current || !audioDuration || !trimDuration) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const fraction = x / rect.width
        const clickedTime = fraction * audioDuration
        // Center the selection on the clicked position
        const halfDuration = trimDuration / 2
        const newStart = Math.max(0, Math.min(clickedTime - halfDuration, audioDuration - trimDuration))
        onSelectionChange(newStart)
    }, [audioDuration, trimDuration, onSelectionChange])

    if (!audioBuffer) return null

    return (
        <div className="card timeline-section animate-slide-up">
            <div className="timeline-section__header">
                <span className="timeline-section__title">Waveform</span>
                <span className="timeline-section__duration">{formatTime(audioDuration)}</span>
            </div>

            <div
                ref={containerRef}
                className="timeline-container"
                onClick={handleTimelineClick}
                id="timeline-container"
            >
                <canvas ref={canvasRef} className="timeline-canvas" />

                {/* Dim overlays */}
                {trimDuration > 0 && audioDuration >= trimDuration && (
                    <>
                        <div
                            className="timeline-overlay timeline-overlay--left"
                            style={{ width: `${Math.max(0, selectionLeft)}%` }}
                        />
                        <div
                            className="timeline-overlay timeline-overlay--right"
                            style={{ width: `${Math.max(0, 100 - selectionLeft - selectionWidth)}%` }}
                        />
                    </>
                )}

                {/* Playback indicator */}
                {playbackPosition !== null && (
                    <div
                        className="playback-indicator"
                        style={{ left: `${playbackPosition}%` }}
                    />
                )}

                {/* SelectionWindow rendered via render prop */}
                {renderSelection && renderSelection(containerRef)}
            </div>

            {/* Time markers */}
            <div className="time-markers">
                {markers.map((m) => (
                    <span
                        key={m.time}
                        className={`time-marker ${m.isMajor ? 'time-marker--major' : ''}`}
                        style={{ left: `${m.position}%` }}
                    >
                        {m.label}
                    </span>
                ))}
            </div>
        </div>
    )
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}
