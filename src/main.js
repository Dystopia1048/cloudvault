import './style.css'

import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'

import {
  CognitoIdentityClient
} from '@aws-sdk/client-cognito-identity'

import {
  fromCognitoIdentityPool
} from '@aws-sdk/credential-providers'


const REGION = 'us-east-1'

const BUCKET_NAME = 'cloudvault-arvind-2026'

const API_URL =
  'https://15fjlbjdwe.execute-api.us-east-1.amazonaws.com'

const IDENTITY_POOL_ID =
  'us-east-1:3b7717ec-2f38-4349-9621-0f9d2686da36'


const s3 = new S3Client({
  region: REGION,

  requestChecksumCalculation: 'WHEN_REQUIRED',

  credentials: fromCognitoIdentityPool({
    client: new CognitoIdentityClient({
      region: REGION
    }),

    identityPoolId: IDENTITY_POOL_ID
  })
})


document.querySelector('#app').innerHTML = `
  <div class="app">

    <header class="navbar">
      <div class="brand">
        <div class="brand-icon">☁</div>

        <div>
          <h1>CloudVault</h1>
          <span>Secure cloud storage</span>
        </div>
      </div>

      <div class="connection">
        <span class="status-dot"></span>
        Connected
      </div>
    </header>


    <main class="container">

      <section class="hero">
        <h2>Your files, securely stored.</h2>

        <p>
          Upload, manage and access your files from CloudVault.
        </p>
      </section>

      
<section class="insights-section">
  <div class="section-heading">
    <div>
      <span class="eyebrow">SYSTEM OVERVIEW</span>
      <h2>CloudVault Insights</h2>
      <p>Live statistics from your S3 storage</p>
    </div>
    <span class="live-badge">● LIVE DATA</span>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-label">TOTAL FILES</span>
      <strong id="totalFiles">—</strong>
      <span class="stat-note">Objects in your bucket</span>
    </div>

    <div class="stat-card">
      <span class="stat-label">STORAGE USED</span>
      <strong id="totalStorage">—</strong>
      <span class="stat-note">Combined file size</span>
    </div>

    <div class="stat-card">
      <span class="stat-label">FILE TYPES</span>
      <strong id="typeCount">—</strong>
      <span class="stat-note">Distinct categories</span>
    </div>
  </div>

  <div class="insights-grid">
    <div class="panel">
      <h3>Storage Distribution</h3>
      <p class="panel-description">Breakdown by file type</p>
      <div id="typeBreakdown"></div>
    </div>

    <div class="panel">
      <h3>Recently Modified</h3>
      <p class="panel-description">Latest objects in your bucket</p>
      <div id="recentFiles"></div>
    </div>
  </div>
</section>

      <section class="upload-card">

        <div class="upload-content">

          <div class="upload-icon">
            ↑
          </div>

          <h3>Upload a file</h3>

          <p>
            Select a file from your computer to upload it to CloudVault.
          </p>

          <input
            type="file"
            id="fileInput"
            hidden
          />

          <button id="chooseButton">
            Choose File
          </button>

          <div id="selectedFile"></div>

          <button
            id="uploadButton"
            class="primary-button"
            disabled
          >
            Upload to CloudVault
          </button>

          <p id="uploadStatus"></p>

        </div>

      </section>


      <section class="files-section">

        <div class="files-header">

          <div>
            <h2>Your Files</h2>

            <p id="fileCount">
              Loading files...
            </p>
          </div>

          <input
            id="searchInput"
            type="text"
            placeholder="Search files..."
          />

        </div>


        <div id="fileList">
          <div class="loading">
            Loading your files...
          </div>
        </div>

      </section>

    </main>

  </div>
`


const fileInput =
  document.querySelector('#fileInput')

const chooseButton =
  document.querySelector('#chooseButton')

const uploadButton =
  document.querySelector('#uploadButton')

const selectedFile =
  document.querySelector('#selectedFile')

const uploadStatus =
  document.querySelector('#uploadStatus')

const fileList =
  document.querySelector('#fileList')

const fileCount =
  document.querySelector('#fileCount')

const searchInput =
  document.querySelector('#searchInput')


let selectedFileObject = null

let files = []


chooseButton.addEventListener('click', () => {
  fileInput.click()
})


fileInput.addEventListener('change', () => {

  selectedFileObject = fileInput.files[0]

  if (!selectedFileObject) {
    selectedFile.textContent = ''
    uploadButton.disabled = true
    return
  }

  selectedFile.textContent =
    `Selected: ${selectedFileObject.name}`

  uploadButton.disabled = false
})


uploadButton.addEventListener('click', uploadFile)


searchInput.addEventListener('input', () => {
  renderFiles(searchInput.value)
})


async function uploadFile() {

  if (!selectedFileObject) return

  uploadButton.disabled = true
  uploadStatus.textContent = 'Uploading...'

  try {

    const file = selectedFileObject

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: file.name,
      Body: file,
      ContentType: file.type || 'application/octet-stream'
    })

    await s3.send(command)

    uploadStatus.textContent = 'Upload successful.'

    selectedFile.textContent = ''
    fileInput.value = ''
    selectedFileObject = null

    await loadFiles()

  } catch (error) {

    console.error('UPLOAD ERROR:', error)

    uploadStatus.textContent =
      `Upload failed: ${error.message || error}`

  }

  uploadButton.disabled = false
}



async function loadFiles() {
  fileList.innerHTML =
    '<div class="loading">Loading your files...</div>'

  try {
    const response = await fetch(`${API_URL}/files`)

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }

    const result = await response.json()

    // Convert the API response to the format the UI already uses.
    files = (result.files || []).map(file => ({
      Key: file.name,
      Size: file.size,
      LastModified: file.lastModified
    }))

    updateInsights(files)

    fileCount.textContent =
      `${files.length} file${files.length === 1 ? '' : 's'}`

    renderFiles(searchInput.value)

  } catch (error) {
    console.error('LOAD FILES ERROR:', error)

    fileList.innerHTML = `
      <div class="error">
        Unable to load files. Check your API connection.
      </div>
    `

    fileCount.textContent = 'Unable to load files'
  }
}


function updateInsights(fileData) {
  const totalSize = fileData.reduce(
    (sum, file) => sum + (file.Size || 0), 0
  )

  document.querySelector('#totalFiles').textContent =
    fileData.length.toLocaleString()

  document.querySelector('#totalStorage').textContent =
    formatFileSize(totalSize)

  const categories = {}

  fileData.forEach(file => {
    const name = file.Key || ''
    const ext = name.includes('.')
      ? name.split('.').pop().toLowerCase()
      : 'other'

    let type = 'Other'

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      type = 'Images'
    } else if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
      type = 'Documents'
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
      type = 'Spreadsheets'
    } else if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) {
      type = 'Videos'
    } else if (['mp3', 'wav', 'flac', 'm4a'].includes(ext)) {
      type = 'Audio'
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      type = 'Archives'
    }

    if (!categories[type]) {
      categories[type] = { count: 0, size: 0 }
    }

    categories[type].count++
    categories[type].size += file.Size || 0
  })

  document.querySelector('#typeCount').textContent =
    Object.keys(categories).length

  const breakdown = document.querySelector('#typeBreakdown')

  const entries = Object.entries(categories)
    .sort((a, b) => b[1].size - a[1].size)

  if (!entries.length) {
    breakdown.innerHTML = '<p class="muted">No files to analyze yet.</p>'
  } else {
    breakdown.innerHTML = entries.map(([type, data]) => {
      const percent = totalSize
        ? (data.size / totalSize) * 100
        : (data.count / fileData.length) * 100

      return `
        <div class="type-row">
          <div class="type-label">
            <span>${escapeHtml(type)}</span>
            <span>${data.count} file${data.count === 1 ? '' : 's'}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill"
                 style="width:${percent}%"></div>
          </div>
          <div class="type-size">${formatFileSize(data.size)}</div>
        </div>
      `
    }).join('')
  }

  const recent = [...fileData]
    .sort((a, b) =>
      new Date(b.LastModified || 0) -
      new Date(a.LastModified || 0)
    )
    .slice(0, 4)

  document.querySelector('#recentFiles').innerHTML =
    recent.length
      ? recent.map(file => `
          <div class="recent-row">
            <div class="recent-icon">▤</div>
            <div class="recent-info">
              <strong>${escapeHtml(file.Key)}</strong>
              <span>${file.LastModified
                ? new Date(file.LastModified).toLocaleString()
                : 'Date unavailable'}</span>
            </div>
            <span class="recent-size">${formatFileSize(file.Size || 0)}</span>
          </div>
        `).join('')
      : '<p class="muted">No files available.</p>'
}


function renderFiles(searchTerm = '') {

  const filteredFiles =
    files.filter(file =>
      file.Key
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )


  if (filteredFiles.length === 0) {

    fileList.innerHTML = `
      <div class="empty">
        No files found.
      </div>
    `

    return
  }


  fileList.innerHTML = filteredFiles.map(file => {

    const size =
      formatFileSize(file.Size)

    const date =
      file.LastModified
        ? new Date(file.LastModified).toLocaleString()
        : ''

    return `
      <div class="file-row">

        <div class="file-info">

          <div class="file-icon">
            📄
          </div>

          <div>
            <strong>${escapeHtml(file.Key)}</strong>

            <span>
              ${size} · ${date}
            </span>
          </div>

        </div>


        <div class="file-actions">

          <button
            class="download-button"
            data-file="${encodeURIComponent(file.Key)}"
          >
            Download
          </button>

          <button
            class="delete-button"
            data-file="${encodeURIComponent(file.Key)}"
          >
            Delete
          </button>

        </div>

      </div>
    `

  }).join('')


  document
    .querySelectorAll('.download-button')
    .forEach(button => {

      button.addEventListener('click', () => {

        downloadFile(
          decodeURIComponent(button.dataset.file)
        )

      })

    })


  document
    .querySelectorAll('.delete-button')
    .forEach(button => {

      button.addEventListener('click', () => {

        deleteFile(
          decodeURIComponent(button.dataset.file)
        )

      })

    })
}


async function downloadFile(key) {

  try {

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      })
    )

    const blob =
      await response.Body.transformToByteArray()

    const url =
      URL.createObjectURL(
        new Blob([blob])
      )

    const link =
      document.createElement('a')

    link.href = url

    link.download = key

    link.click()

    URL.revokeObjectURL(url)

  } catch (error) {

    console.error(error)

    alert('Download failed.')

  }
}


async function deleteFile(key) {

  const confirmed =
    confirm(`Delete "${key}"?`)

  if (!confirmed) return

  try {

    await s3.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      })
    )

    await loadFiles()

  } catch (error) {

    console.error(error)

    alert('Delete failed.')

  }
}


function formatFileSize(bytes) {

  if (!bytes) return '0 Bytes'

  const units =
    ['Bytes', 'KB', 'MB', 'GB']

  const index =
    Math.floor(
      Math.log(bytes) /
      Math.log(1024)
    )

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(1)} ${units[index]}`
}


function escapeHtml(text) {

  const div =
    document.createElement('div')

  div.textContent = text

  return div.innerHTML
}


loadFiles()