import { useState, useCallback } from 'react'
import { Mp3Encoder } from '@breezystack/lamejs'

/**
 * ExportManager – Slices AudioBuffer to the selected duration and exports as WAV or MP3.
 */
export default function ExportManager({ audioBuffer, selectedStart, audioDuration, fileName, trimDuration = 30, isTrimValid = false }) {
    const [isExporting, setIsExporting] = useState(false)
    const [exportSuccess, setExportSuccess] = useState(false)
    const [exportError, setExportError] = useState(null)
    const [exportFormat, setExportFormat] = useState(null)

    const canExport = audioBuffer && isTrimValid && audioDuration >= trimDuration

    /**
     * Slice the AudioBuffer to the selected region.
     * Returns { channels: Float32Array[], sampleRate, numChannels, numSamples }
     */
    const getSlicedData = useCallback(() => {
        const sampleRate = audioBuffer.sampleRate
        const numChannels = audioBuffer.numberOfChannels
        const startSample = Math.floor(selectedStart * sampleRate)
        const endSample = Math.min(
            Math.floor((selectedStart + trimDuration) * sampleRate),
            audioBuffer.length
        )
        const numSamples = endSample - startSample

        const channels = []
        for (let ch = 0; ch < numChannels; ch++) {
            const sourceData = audioBuffer.getChannelData(ch)
            const sliced = new Float32Array(numSamples)
            for (let i = 0; i < numSamples; i++) {
                sliced[i] = sourceData[startSample + i]
            }
            channels.push(sliced)
        }

        return { channels, sampleRate, numChannels, numSamples }
    }, [audioBuffer, selectedStart, trimDuration])

    /**
     * Trigger a browser download from a Blob.
     */
    const downloadBlob = useCallback((blob, extension) => {
        const baseName = fileName ? fileName.replace(/\.[^.]+$/, '') : 'looptrim'
        const downloadName = `${baseName}_trimmed.${extension}`
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, [fileName])

    /**
     * Export as WAV.
     */
    const handleExportWAV = useCallback(() => {
        if (!canExport) return
        setIsExporting(true)
        setExportFormat('wav')
        setExportSuccess(false)
        setExportError(null)

        try {
            const data = getSlicedData()
            const wavBlob = encodeWAV(data)
            downloadBlob(wavBlob, 'wav')
            setExportSuccess(true)
            setTimeout(() => setExportSuccess(false), 4000)
        } catch (err) {
            console.error('WAV export error:', err)
            setExportError('WAV export failed: ' + err.message)
        } finally {
            setIsExporting(false)
            setExportFormat(null)
        }
    }, [canExport, getSlicedData, downloadBlob])

    /**
     * Export as MP3.
     */
    const handleExportMP3 = useCallback(() => {
        if (!canExport) return
        setIsExporting(true)
        setExportFormat('mp3')
        setExportSuccess(false)
        setExportError(null)

        try {
            const data = getSlicedData()
            const mp3Blob = encodeMP3(data)
            downloadBlob(mp3Blob, 'mp3')
            setExportSuccess(true)
            setTimeout(() => setExportSuccess(false), 4000)
        } catch (err) {
            console.error('MP3 export error:', err)
            setExportError('MP3 export failed: ' + err.message)
        } finally {
            setIsExporting(false)
            setExportFormat(null)
        }
    }, [canExport, getSlicedData, downloadBlob])

    if (!audioBuffer) return null

    return (
        <div className="controls animate-slide-up" style={{ paddingTop: 0 }}>
            <button
                className="btn btn--accent"
                onClick={handleExportWAV}
                disabled={!canExport || isExporting}
                id="export-wav-btn"
            >
                <span className="btn__icon">
                    {isExporting && exportFormat === 'wav' ? '⏳' : '💾'}
                </span>
                {isExporting && exportFormat === 'wav' ? 'Exporting…' : 'Export WAV'}
            </button>

            <button
                className="btn btn--accent"
                onClick={handleExportMP3}
                disabled={!canExport || isExporting}
                id="export-mp3-btn"
            >
                <span className="btn__icon">
                    {isExporting && exportFormat === 'mp3' ? '⏳' : '🎵'}
                </span>
                {isExporting && exportFormat === 'mp3' ? 'Encoding…' : 'Export MP3'}
            </button>

            {exportSuccess && (
                <div className="export-success">
                    <span>✓</span> Exported successfully!
                </div>
            )}

            {exportError && (
                <div className="error-message">
                    <span>⚠</span> {exportError}
                </div>
            )}
        </div>
    )
}

/* ============================================================
   WAV Encoder (PCM 16-bit)
   ============================================================ */

function encodeWAV({ channels, sampleRate, numChannels, numSamples }) {
    // Interleave channels
    const interleaved = new Float32Array(numSamples * numChannels)
    for (let ch = 0; ch < numChannels; ch++) {
        for (let i = 0; i < numSamples; i++) {
            interleaved[i * numChannels + ch] = channels[ch][i]
        }
    }

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(interleaved.length)
    for (let i = 0; i < interleaved.length; i++) {
        const s = Math.max(-1, Math.min(1, interleaved[i]))
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    // Build WAV file
    const byteRate = sampleRate * numChannels * 2
    const blockAlign = numChannels * 2
    const dataSize = pcmData.length * 2
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeString(view, 8, 'WAVE')
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    const uint8 = new Uint8Array(buffer)
    const pcmBytes = new Uint8Array(pcmData.buffer)
    uint8.set(pcmBytes, 44)

    return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
    }
}

/* ============================================================
   MP3 Encoder (via lamejs)
   ============================================================ */

function encodeMP3({ channels, sampleRate, numChannels: rawChannels, numSamples }) {
    const numChannels = Math.min(rawChannels, 2) // lamejs supports max 2 channels
    const kbps = 192
    const blockSize = 1152

    const mp3encoder = new Mp3Encoder(numChannels, sampleRate, kbps)
    const mp3Data = []

    // Convert Float32 [-1,1] to Int16
    const int16Channels = []
    for (let ch = 0; ch < numChannels; ch++) {
        const float32 = channels[ch]
        const int16 = new Int16Array(numSamples)
        for (let i = 0; i < numSamples; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]))
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        int16Channels.push(int16)
    }

    // Encode in blocks
    for (let i = 0; i < numSamples; i += blockSize) {
        const end = Math.min(i + blockSize, numSamples)
        const leftChunk = int16Channels[0].subarray(i, end)
        const rightChunk = numChannels > 1 ? int16Channels[1].subarray(i, end) : leftChunk

        let mp3buf
        if (numChannels === 1) {
            mp3buf = mp3encoder.encodeBuffer(leftChunk)
        } else {
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk)
        }

        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf)
        }
    }

    // Flush remaining
    const tail = mp3encoder.flush()
    if (tail.length > 0) {
        mp3Data.push(tail)
    }

    return new Blob(mp3Data, { type: 'audio/mpeg' })
}
