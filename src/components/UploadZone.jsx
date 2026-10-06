import { useState, useRef, useCallback } from 'react'

const ACCEPTED_TYPES = ['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav', 'audio/ogg']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function UploadZone({ onAudioDecoded }) {
    const [isHovering, setIsHovering] = useState(false)
    const [error, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [fileInfo, setFileInfo] = useState(null)
    const fileInputRef = useRef(null)

    const processFile = useCallback(async (file) => {
        setError(null)

        // Validate type
        if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(webm|mp3|wav|ogg|m4a)$/i)) {
            setError('Unsupported format. Please upload WebM, MP3, WAV, or OGG audio files.')
            return
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            setError(`File too large (${formatFileSize(file.size)}). Maximum size is 50 MB.`)
            return
        }

        setIsLoading(true)
        setFileInfo({ name: file.name, size: file.size, type: file.type })

        try {
            const arrayBuffer = await file.arrayBuffer()
            const audioContext = new (window.AudioContext || window.webkitAudioContext)()
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
            audioContext.close()

            const duration = audioBuffer.duration
            setIsLoading(false)
            onAudioDecoded(audioBuffer, duration, file.name)
        } catch (err) {
            console.error('Audio decode error:', err)
            setIsLoading(false)
            setFileInfo(null)
            setError('Failed to decode audio. The file may be corrupted or use an unsupported codec.')
        }
    }, [onAudioDecoded])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsHovering(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsHovering(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        e.stopPropagation()
        setIsHovering(false)
    }, [])

    const handleFileSelect = useCallback((e) => {
        const file = e.target.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleRemove = useCallback(() => {
        setFileInfo(null)
        setError(null)
        onAudioDecoded(null, 0, '')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }, [onAudioDecoded])

    if (isLoading) {
        return (
            <div className="card">
                <div className="loading-spinner">
                    <div className="loading-spinner__circle" />
                    <div className="loading-spinner__text">Decoding audio…</div>
                </div>
            </div>
        )
    }

    if (fileInfo && !isLoading) {
        return (
            <div className="card file-info animate-slide-up">
                <div className="file-info__icon">🎵</div>
                <div className="file-info__details">
                    <div className="file-info__name">{fileInfo.name}</div>
                    <div className="file-info__meta">{formatFileSize(fileInfo.size)}</div>
                </div>
                <button
                    className="file-info__remove"
                    onClick={handleRemove}
                    title="Remove file"
                    id="remove-file-btn"
                >
                    ✕
                </button>
            </div>
        )
    }

    return (
        <div
            className={`card upload-zone ${isHovering ? 'upload-zone--hover' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            id="upload-zone"
        >
            <div className="upload-zone__icon">🎧</div>
            <div className="upload-zone__text">
                <div className="upload-zone__text-primary">
                    Drop your audio file here
                </div>
                <div className="upload-zone__text-secondary">
                    or click to browse · WebM, MP3, WAV, OGG · Max 50 MB
                </div>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept=".webm,.mp3,.wav,.ogg,.m4a,audio/*"
                onChange={handleFileSelect}
                id="file-input"
            />
            {error && (
                <div className="error-message">
                    <span>⚠</span> {error}
                </div>
            )}
        </div>
    )
}
