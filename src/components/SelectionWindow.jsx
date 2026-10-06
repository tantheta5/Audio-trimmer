import { useRef, useCallback, useState, useEffect } from 'react'

/**
 * SelectionWindow is the draggable overlay on the timeline.
 * Uses pointer events for smooth cross-device dragging.
 * Supports dynamic trim durations (preset 30s or custom).
 */
export default function SelectionWindow({
    audioDuration,
    selectedStart,
    onSelectionChange,
    containerRef,
    trimDuration = 30,
    isDraggable = true,
}) {
    const windowRef = useRef(null)
    const [isDragging, setIsDragging] = useState(false)
    const dragStartRef = useRef({ x: 0, startVal: 0 })

    // Clamp selectedStart so the window can never exceed audio bounds
    const clampedStart = Math.max(0, Math.min(selectedStart, audioDuration - trimDuration))
    const selectionEnd = Math.min(clampedStart + trimDuration, audioDuration)
    const actualDuration = selectionEnd - clampedStart
    const widthPercent = Math.min((trimDuration / audioDuration) * 100, 100)
    const leftPercent = Math.min((clampedStart / audioDuration) * 100, 100 - widthPercent)

    const handlePointerDown = useCallback((e) => {
        if (!isDraggable) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
        dragStartRef.current = { x: e.clientX, startVal: selectedStart }
        windowRef.current?.setPointerCapture(e.pointerId)
    }, [selectedStart, isDraggable])

    const handlePointerMove = useCallback((e) => {
        if (!isDragging || !containerRef?.current) return
        const containerWidth = containerRef.current.clientWidth
        const deltaX = e.clientX - dragStartRef.current.x
        const deltaSeconds = (deltaX / containerWidth) * audioDuration
        let newStart = dragStartRef.current.startVal + deltaSeconds

        // Clamp to valid range
        newStart = Math.max(0, Math.min(newStart, audioDuration - trimDuration))

        // Snap to 0.1s precision
        newStart = Math.round(newStart * 10) / 10

        onSelectionChange(newStart)
    }, [isDragging, audioDuration, trimDuration, onSelectionChange, containerRef])

    const handlePointerUp = useCallback((e) => {
        setIsDragging(false)
        windowRef.current?.releasePointerCapture(e.pointerId)
    }, [])

    // Global listeners for pointer move/up during drag
    useEffect(() => {
        if (!isDragging) return
        const onMove = (e) => handlePointerMove(e)
        const onUp = (e) => handlePointerUp(e)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
    }, [isDragging, handlePointerMove, handlePointerUp])

    if (!audioDuration || audioDuration < trimDuration) return null

    return (
        <div
            ref={windowRef}
            className={`selection-window ${isDragging ? 'selection-window--dragging' : ''} ${!isDraggable ? 'selection-window--locked' : ''}`}
            style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
            }}
            onPointerDown={handlePointerDown}
            id="selection-window"
        >
            <span className="selection-window__label selection-window__label--start">
                {formatTimePrecise(clampedStart)}
            </span>
            <span className="selection-window__label selection-window__label--end">
                {formatTimePrecise(selectionEnd)}
            </span>
            <span className="selection-window__label selection-window__label--center">
                {actualDuration.toFixed(1)}s
            </span>
        </div>
    )
}

function formatTimePrecise(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}
