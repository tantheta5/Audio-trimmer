import { useState, useCallback, useEffect } from 'react'
import UploadZone from './components/UploadZone'
import Timeline from './components/Timeline'
import SelectionWindow from './components/SelectionWindow'
import Controls from './components/Controls'
import ExportManager from './components/ExportManager'
import { useAudioPlayback } from './hooks/useAudioPlayback'

export default function App() {
    const [audioBuffer, setAudioBuffer] = useState(null)
    const [audioDuration, setAudioDuration] = useState(0)
    const [selectedStart, setSelectedStart] = useState(0)
    const [fileName, setFileName] = useState('')

    // Trim mode: 'preset' (30s) or 'custom'
    const [trimMode, setTrimMode] = useState('preset')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    // Compute effective start/duration based on mode
    const customStartVal = parseFloat(customStart) || 0
    const customEndVal = parseFloat(customEnd) || 0

    let trimDuration, effectiveStart, isTrimValid
    if (trimMode === 'preset') {
        trimDuration = 30
        effectiveStart = selectedStart
        isTrimValid = audioDuration >= 30
    } else {
        trimDuration = customEndVal - customStartVal
        effectiveStart = customStartVal
        isTrimValid = customStartVal >= 0 &&
            customEndVal > customStartVal &&
            customEndVal <= audioDuration &&
            trimDuration > 0
    }

    const {
        isPlaying,
        currentTime,
        playbackMode,
        playFull,
        playSelected,
        pause,
    } = useAudioPlayback(audioBuffer)

    const handleAudioDecoded = useCallback((buffer, duration, name) => {
        if (!buffer) {
            setAudioBuffer(null)
            setAudioDuration(0)
            setSelectedStart(0)
            setFileName('')
            return
        }
        setAudioBuffer(buffer)
        setAudioDuration(duration)
        setSelectedStart(0)
        setFileName(name)
    }, [])

    // For preset mode: drag/click updates selectedStart
    const handleSelectionChange = useCallback((newStart) => {
        if (trimMode === 'custom') return // Custom mode: start/end are typed, not dragged
        setSelectedStart(prev => {
            const clamped = Math.max(0, Math.min(newStart, audioDuration - 30))
            return Math.round(clamped * 10) / 10
        })
    }, [audioDuration, trimMode])

    const handleTrimModeChange = useCallback((mode) => {
        setTrimMode(mode)
        setSelectedStart(0)
        setCustomStart('')
        setCustomEnd('')
    }, [])

    // Sync selectedStart from custom inputs
    useEffect(() => {
        if (trimMode === 'custom' && customStartVal >= 0) {
            setSelectedStart(customStartVal)
        }
    }, [trimMode, customStartVal])

    // Re-clamp selectedStart for preset mode
    useEffect(() => {
        if (trimMode === 'preset' && audioDuration > 0) {
            setSelectedStart(prev => {
                const maxStart = Math.max(0, audioDuration - 30)
                return Math.min(prev, maxStart)
            })
        }
    }, [trimMode, audioDuration])

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <h1 className="header__logo">LoopTrim</h1>
                <p className="header__tagline">
                    Extract precise audio segments — right in your browser
                </p>
            </header>

            {/* Upload */}
            <UploadZone onAudioDecoded={handleAudioDecoded} />

            {/* Trim Mode Selector */}
            {audioBuffer && (
                <div className="card trim-mode-card animate-slide-up">
                    <div className="trim-mode__header">
                        <span className="trim-mode__title">✂️ Trim Duration</span>
                    </div>
                    <div className="trim-mode__options">
                        <button
                            className={`trim-mode__btn ${trimMode === 'preset' ? 'trim-mode__btn--active' : ''}`}
                            onClick={() => handleTrimModeChange('preset')}
                            id="trim-preset-btn"
                        >
                            <span className="trim-mode__btn-icon">⏱️</span>
                            <span className="trim-mode__btn-label">30 Seconds</span>
                            <span className="trim-mode__btn-desc">Quick preset</span>
                        </button>
                        <button
                            className={`trim-mode__btn ${trimMode === 'custom' ? 'trim-mode__btn--active' : ''}`}
                            onClick={() => handleTrimModeChange('custom')}
                            id="trim-custom-btn"
                        >
                            <span className="trim-mode__btn-icon">🎛️</span>
                            <span className="trim-mode__btn-label">Custom</span>
                            <span className="trim-mode__btn-desc">Start &amp; end time</span>
                        </button>
                    </div>

                    {/* Custom start/end inputs */}
                    {trimMode === 'custom' && (
                        <div className="trim-custom-input animate-slide-up">
                            <div className="trim-custom-input__row">
                                <div className="trim-custom-input__group">
                                    <label className="trim-custom-input__label" htmlFor="custom-start-input">
                                        Start time
                                    </label>
                                    <div className="trim-custom-input__wrapper">
                                        <input
                                            type="number"
                                            id="custom-start-input"
                                            className="trim-custom-input__field"
                                            value={customStart}
                                            onChange={(e) => setCustomStart(e.target.value)}
                                            placeholder="0.0"
                                            min="0"
                                            max={audioDuration}
                                            step="0.1"
                                        />
                                        <span className="trim-custom-input__unit">sec</span>
                                    </div>
                                </div>
                                <div className="trim-custom-input__group">
                                    <label className="trim-custom-input__label" htmlFor="custom-end-input">
                                        End time
                                    </label>
                                    <div className="trim-custom-input__wrapper">
                                        <input
                                            type="number"
                                            id="custom-end-input"
                                            className="trim-custom-input__field"
                                            value={customEnd}
                                            onChange={(e) => setCustomEnd(e.target.value)}
                                            placeholder={audioDuration.toFixed(1)}
                                            min="0"
                                            max={audioDuration}
                                            step="0.1"
                                        />
                                        <span className="trim-custom-input__unit">sec</span>
                                    </div>
                                </div>
                            </div>
                            {/* Validation feedback */}
                            {(customStart || customEnd) && !isTrimValid && (
                                <span className="trim-custom-input__error">
                                    {customEndVal <= customStartVal
                                        ? 'End time must be after start time'
                                        : customEndVal > audioDuration
                                            ? `End time can't exceed ${audioDuration.toFixed(1)}s`
                                            : customStartVal < 0
                                                ? 'Start time can\'t be negative'
                                                : 'Enter valid start and end times'
                                    }
                                </span>
                            )}
                            {isTrimValid && (
                                <span className="trim-custom-input__valid">
                                    ✓ {trimDuration.toFixed(1)}s selection — {customStartVal.toFixed(1)}s to {customEndVal.toFixed(1)}s
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Timeline + Selection */}
            {audioBuffer && (
                <Timeline
                    audioBuffer={audioBuffer}
                    audioDuration={audioDuration}
                    selectedStart={effectiveStart}
                    onSelectionChange={handleSelectionChange}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    trimDuration={trimDuration}
                    renderSelection={(containerRef) =>
                        isTrimValid && audioDuration >= trimDuration ? (
                            <SelectionWindow
                                audioDuration={audioDuration}
                                selectedStart={effectiveStart}
                                onSelectionChange={handleSelectionChange}
                                containerRef={containerRef}
                                trimDuration={trimDuration}
                                isDraggable={trimMode === 'preset'}
                            />
                        ) : null
                    }
                />
            )}

            {/* Controls */}
            {audioBuffer && (
                <Controls
                    audioBuffer={audioBuffer}
                    audioDuration={audioDuration}
                    selectedStart={effectiveStart}
                    isPlaying={isPlaying}
                    playbackMode={playbackMode}
                    onPlayFull={playFull}
                    onPlaySelected={playSelected}
                    onPause={pause}
                    trimDuration={trimDuration}
                    isTrimValid={isTrimValid}
                />
            )}

            {/* Export */}
            {audioBuffer && (
                <ExportManager
                    audioBuffer={audioBuffer}
                    selectedStart={effectiveStart}
                    audioDuration={audioDuration}
                    fileName={fileName}
                    trimDuration={trimDuration}
                    isTrimValid={isTrimValid}
                />
            )}
        </div>
    )
}
