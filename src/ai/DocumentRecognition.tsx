import { useEffect, useState } from 'react'
import { Camera, Check, FileImage, LoaderCircle, ShieldCheck, Trash2, X } from 'lucide-react'
import {
  applyExtraction,
  availableExtractionFields,
  extractionFieldLabels,
  recommendedExtractionFields,
  type ExtractionFieldKey,
  type PropertyDocumentExtraction,
} from './propertyDocument'
import type { PropertyProfile } from '../properties/propertyProfiles'
import { recognizePropertyImages, type OcrProgress } from './localOcr'
import './DocumentRecognition.css'

type SelectedImage = {
  id: string
  name: string
  dataUrl: string
  size: number
}

const MAX_IMAGES = 20
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

function readFile(file: File): Promise<SelectedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve({
      id: crypto.randomUUID(),
      name: file.name,
      dataUrl: String(reader.result),
      size: file.size,
    })
    reader.onerror = () => reject(new Error(`無法讀取 ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function displayValue(value: string | number | null) {
  if (value === null) return '未辨識'
  return typeof value === 'number'
    ? new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(value)
    : value
}

export function DocumentRecognition({
  profile,
  onApply,
  onClose,
}: {
  profile: PropertyProfile
  onApply: (profile: PropertyProfile) => void
  onClose: () => void
}) {
  const [images, setImages] = useState<SelectedImage[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState('')
  const [extraction, setExtraction] = useState<PropertyDocumentExtraction | null>(null)
  const [selected, setSelected] = useState<ExtractionFieldKey[]>([])

  useEffect(() => {
    if (extraction) setSelected(recommendedExtractionFields(extraction))
  }, [extraction])

  const addImages = async (files: FileList | null) => {
    if (!files) return
    setError('')
    const candidates = Array.from(files)
    if (images.length + candidates.length > MAX_IMAGES) {
      setError(`一次最多選擇 ${MAX_IMAGES} 張照片。`)
      return
    }
    const invalid = candidates.find(file => !allowedTypes.includes(file.type) || file.size > MAX_IMAGE_BYTES)
    if (invalid) {
      setError(`${invalid.name} 格式不支援或超過 10 MB。`)
      return
    }
    try {
      const addedImages = await Promise.all(candidates.map(readFile))
      setImages(current => [...current, ...addedImages])
      setExtraction(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '讀取照片失敗。')
    }
  }

  const recognize = async () => {
    if (!images.length) return
    setLoading(true)
    setError('')
    setExtraction(null)
    setProgress({ imageIndex: 1, imageCount: images.length, status: '準備本機辨識', progress: 0 })
    try {
      setExtraction(await recognizePropertyImages(images, setProgress))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '本機辨識失敗，請確認網路後重試。')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const toggle = (key: ExtractionFieldKey) =>
    setSelected(current => current.includes(key)
      ? current.filter(item => item !== key)
      : [...current, key])

  return <div className="drawerBackdrop aiBackdrop" role="presentation" onMouseDown={onClose}>
    <aside className="drawer aiRecognition" role="dialog" aria-modal="true" aria-label="本機文件辨識" onMouseDown={event => event.stopPropagation()}>
      <div className="drawerHeader">
        <div><p className="eyebrow">ON-DEVICE OCR</p><h2>免費本機辨識與校準</h2></div>
        <button aria-label="關閉本機文件辨識" onClick={onClose}><X size={20}/></button>
      </div>

      {!extraction ? <>
        <div className="privacyNotice"><ShieldCheck size={22}/><div><b>照片只在這台裝置處理</b><p>不會上傳房屋文件、不需要 API key，也沒有按次費用。第一次使用需下載免費的中英文辨識元件。</p></div></div>
        <label className="imageDrop">
          <Camera size={25}/>
          <strong>拍照或選擇多張文件</strong>
          <span>JPEG、PNG、WebP；每張 10 MB；一次最多 {MAX_IMAGES} 張</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={event => void addImages(event.target.files)} />
        </label>
        {images.length > 0 && <div className="imageBatch">
          <div className="batchHeader"><b>已選擇 {images.length} 張</b><span>順序就是辨識頁碼</span></div>
          <div className="imageGrid">{images.map((image, index) => <div className="imageItem" key={image.id}>
            <img src={image.dataUrl} alt={`第 ${index + 1} 張 ${image.name}`}/>
            <span>{index + 1}</span>
            <button aria-label={`移除 ${image.name}`} onClick={() => setImages(current => current.filter(item => item.id !== image.id))}><Trash2 size={14}/></button>
            <small title={image.name}>{image.name}</small>
          </div>)}</div>
        </div>}
        {error && <div className="aiError">{error}</div>}
        {loading && progress && <div className="ocrProgress">
          <div><span>照片 {progress.imageIndex} / {progress.imageCount}</span><strong>{Math.round(progress.progress * 100)}%</strong></div>
          <progress max="1" value={progress.progress}/>
          <small>{progress.status}</small>
        </div>}
        <button className="recognizeButton" disabled={!images.length || loading} onClick={() => void recognize()}>
          {loading ? <><LoaderCircle className="spin" size={17}/>正在本機閱讀照片…</> : <><FileImage size={17}/>開始免費本機辨識</>}
        </button>
      </> : <>
        <div className="calibrationIntro"><Check size={20}/><div><b>辨識完成，請逐項校準</b><p>80% 以上且無衝突的欄位已預先勾選；仍請依原始照片確認。</p></div></div>
        {extraction.warnings.length > 0 && <div className="aiWarnings"><b>需要特別確認</b>{extraction.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
        <div className="extractionList">{availableExtractionFields(extraction).map(key => {
          const field = extraction.fields[key]
          const confidence = Math.round(field.confidence * 100)
          return <label className={`extractionField ${field.conflict ? 'hasConflict' : ''}`} key={key}>
            <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)}/>
            <div><span>{extractionFieldLabels[key]}</span><strong>{displayValue(field.value)}</strong><small>{field.evidence || '沒有文字依據'}{field.imageIndex ? `・照片 ${field.imageIndex}` : ''}</small></div>
            <em>{field.conflict ? '有衝突' : `${confidence}%`}</em>
          </label>
        })}</div>
        {availableExtractionFields(extraction).length === 0 && <div className="aiError">這批照片沒有辨識出可用欄位，請換更清晰的照片。</div>}
        <div className="calibrationActions">
          <button onClick={() => setExtraction(null)}>返回照片</button>
          <button disabled={!selected.length} onClick={() => onApply(applyExtraction(profile, extraction, selected))}>套用 {selected.length} 個欄位</button>
        </div>
        <p className="calibrationFootnote">套用只會填入目前表單；回到房屋基本資料後，還要按「儲存並套用」才會正式保存。</p>
      </>}
    </aside>
  </div>
}
