/**
 * Controls – Playback controls and selection info.
 */
export default function Controls({
    audioBuffer,
    audioDuration,
    selectedStart,
    isPlaying,
    playbackMode,
    onPlayFull,
    onPlaySelected,
    onPause,
    trimDuration = 30,
    isTrimValid = false,
}) {
    const canTrim = isTrimValid && audioDuration >= trimDuration
    const selectionEnd = selectedStart + trimDuration

    return (
        <div className="card animate-slide-up">
            {/* Selection info */}
            {canTrim && (
                <div className="selection-info">
                    <span className="selection-info__item">
                        Start: <span className="selection-info__value">{formatTime(selectedStart)}</span>
                    </span>
                    <span className="selection-info__item">
                        End: <span className="selection-info__value">{formatTime(selectionEnd)}</span>
                    </span>
                    <span className="selection-info__item">
                        Duration: <span className="selection-info__value">{trimDuration.toFixed(1)}s</span>
                    </span>
                </div>
            )}

            {/* Buttons */}
            <div className="controls">
                <button
                    className="btn"
                    onClick={onPlayFull}
                    disabled={!audioBuffer || isPlaying}
                    id="play-full-btn"
                >
                    <span className="btn__icon">▶</span>
                    Play Full
                </button>

                <button
                    className="btn btn--primary"
                    onClick={() => onPlaySelected(selectedStart, trimDuration)}
                    disabled={!audioBuffer || !canTrim || isPlaying}
                    id="play-selected-btn"
                >
                    <span className="btn__icon">🎯</span>
                    Play Selected {trimDuration}s
                </button>

                <button
                    className="btn btn--danger"
                    onClick={onPause}
                    disabled={!isPlaying}
                    id="pause-btn"
                >
                    <span className="btn__icon">⏸</span>
                    Pause
                </button>
            </div>

            {/* Short audio warning */}
            {audioBuffer && !canTrim && (
                <div className="short-audio-warning">
                    <span>⚠️</span>
                    {trimDuration > 0
                        ? `Audio is shorter than ${trimDuration}s — trimming is disabled.`
                        : 'Enter a valid trim duration to enable trimming.'
                    }
                </div>
            )}
        </div>
    )
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}
