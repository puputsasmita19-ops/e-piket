import { AttachmentMeta } from '../types';
import { compressImageAuto, CompressionResult } from '../utils/imageCompressor';
import { db, doc, setDoc } from './firebase';

/**
 * Enhanced Google Drive Service with deep diagnostics logging,
 * automatic 401 Unauthorized token re-validation, and error handling.
 */

export const DEFAULT_DRIVE_FOLDER_ID = '18lJTqdfpB0NtY23aaxoAvq84GiTcCksQ';

/**
 * Normalizes and extracts pure Google Drive folder ID from raw input,
 * removing any URL query params (e.g. ?hl, ?usp=sharing), full URL paths, or trailing slashes.
 */
export const extractDriveFolderId = (input?: string | null): string => {
  if (!input) return DEFAULT_DRIVE_FOLDER_ID;
  let clean = input.trim();
  // Extract folder ID if given as a full URL
  const match = clean.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Strip URL query parameters (e.g. ?hl, ?usp=sharing, ?authuser=0) and URL hashes
  clean = clean.split('?')[0].split('#')[0].trim();
  clean = clean.replace(/\/+$/, '');
  return clean || DEFAULT_DRIVE_FOLDER_ID;
};

export interface UploadFileOptions {
  schoolName: string;
  schoolYear: string;
  semester: string;
  postName: string;
  uploaderName: string;
  category: string;
  entityType: 'incident' | 'logbook' | 'profile' | 'general';
  entityId?: string;
  customMimeType?: string;
  targetFolderId?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  createdTime: string;
  modifiedTime?: string;
  originalSizeFormatted?: string;
  compressedSizeFormatted?: string;
  savingsPercentage?: number;
}

type TokenRefreshCallback = () => Promise<string | null>;
let onTokenRefreshRequired: TokenRefreshCallback | null = null;

export const setDriveTokenRefreshCallback = (callback: TokenRefreshCallback) => {
  onTokenRefreshRequired = callback;
  console.log('[GoogleDriveService] Callback re-validasi token otomatis terdaftar.');
};

/**
 * Helper to execute fetch with automatic 401 Unauthorized token re-validation and retry
 */
export const fetchWithTokenAutoRefresh = async (
  url: string,
  options: RequestInit,
  accessToken?: string | null
): Promise<Response> => {
  const currentToken = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('epiket_drive_token') : null);

  const requestHeaders = new Headers(options.headers || {});
  if (currentToken) {
    requestHeaders.set('Authorization', `Bearer ${currentToken}`);
  }

  console.log(`[GoogleDriveService] Request -> ${options.method || 'GET'} ${url}`);
  let response = await fetch(url, { ...options, headers: requestHeaders });

  // Handle 401 Unauthorized: Execute auto token re-validation and retry request
  if (response.status === 401 && onTokenRefreshRequired) {
    console.warn('[GoogleDriveService] ⚠️ Received 401 Unauthorized. Triggering automatic OAuth token re-validation...');
    const freshToken = await onTokenRefreshRequired();
    if (freshToken) {
      console.log('[GoogleDriveService] ✅ OAuth token re-validation successful. Retrying API request with fresh token...');
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(url, { ...options, headers: retryHeaders });
    } else {
      console.error('[GoogleDriveService] ❌ Auto token re-validation failed or user consent required.');
    }
  }

  // Deep logging for authorization or access blocked errors
  if (!response.ok) {
    const status = response.status;
    let errBody = '';
    try {
      errBody = await response.clone().text();
    } catch {}

    console.group(`[GoogleDriveService Error Diagnostics] Status: ${status}`);
    console.error(`URL: ${url}`);
    console.error(`HTTP Status: ${status}`);
    console.error(`Response Output: ${errBody}`);

    if (status === 403) {
      console.warn('💡 Diagnostics: 403 Forbidden / Access Blocked. Check OAuth scopes or domain restriction in Google Cloud Console.');
    } else if (status === 400) {
      console.warn('💡 Diagnostics: 400 Bad Request. Check endpoint parameter syntax or request body format.');
    } else if (status === 401) {
      console.warn('💡 Diagnostics: 401 Unauthorized. Access token expired or revoked.');
    }
    console.groupEnd();
  } else {
    console.log(`[GoogleDriveService] ✅ Response OK (${response.status}) from ${url}`);
  }

  return response;
};

export const compressImage = async (file: File | Blob, maxDimension = 1280, quality = 0.8): Promise<string> => {
  const result = await compressImageAuto(file, { maxDimension, quality, mimeType: 'image/jpeg' });
  return result.dataUrl;
};

export const generateDriveFilePath = (opts: UploadFileOptions): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  
  const cleanSchool = opts.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanYear = opts.schoolYear.replace(/[^a-zA-Z0-9]/g, '-');
  const cleanPost = opts.postName.replace(/[^a-zA-Z0-9]/g, '_');

  if (opts.entityType === 'profile') {
    return `/EPiket/${cleanSchool}/Foto_Profil/${cleanYear}`;
  }

  return `/EPiket/${cleanSchool}/${cleanYear}/${opts.semester}/${year}/${month}/${date}/${cleanPost}`;
};

export const generateDriveFileName = (uploaderName: string, category: string, ext = 'jpg'): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');

  const cleanUploader = uploaderName.replace(/[^a-zA-Z0-9]/g, '');
  const cleanCat = category.replace(/[^a-zA-Z0-9]/g, '');

  return `${year}${month}${day}_${hours}${mins}${secs}_${cleanUploader}_${cleanCat}.${ext}`;
};

export const uploadToGoogleDrive = async (
  file: File | Blob | string,
  options: UploadFileOptions,
  accessToken?: string | null
): Promise<AttachmentMeta> => {
  const compression: CompressionResult = await compressImageAuto(file, {
    maxDimension: options.entityType === 'profile' ? 600 : 1280,
    quality: 0.82,
    mimeType: 'image/jpeg'
  });

  const folderPath = generateDriveFilePath(options);
  const fileName = generateDriveFileName(options.uploaderName, options.category, 'jpg');

  let driveFileId = `gdrive_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  let realDriveUrl: string | undefined = undefined;
  let webContentLink: string | undefined = undefined;

  if (accessToken || (typeof window !== 'undefined' && sessionStorage.getItem('epiket_drive_token'))) {
    try {
      const targetFolderId = extractDriveFolderId(options.targetFolderId);
      const metadata: Record<string, any> = {
        name: fileName,
        mimeType: 'image/jpeg',
        description: `Dokumentasi Piket: ${options.postName} oleh ${options.uploaderName} (${options.category}) - ${folderPath}`,
        parents: [targetFolderId]
      };

      const base64Data = compression.dataUrl.split(',')[1];
      const binaryData = atob(base64Data);
      const byteNumbers = new Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        byteNumbers[i] = binaryData.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
      const imageBlob = new Blob([byteArray], { type: 'image/jpeg' });

      const formBody = new FormData();
      formBody.append('metadata', metadataBlob);
      formBody.append('file', imageBlob);

      let res = await fetchWithTokenAutoRefresh(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink',
        { method: 'POST', body: formBody },
        accessToken
      );

      // If target folder is not accessible (404/403), fallback to uploading without parents
      if (!res.ok && res.status >= 400 && metadata.parents) {
        console.warn(`[GoogleDriveService] Upload to folder '${targetFolderId}' returned HTTP ${res.status}. Falling back to root Drive...`);
        const fallbackMetadata = {
          name: fileName,
          mimeType: 'image/jpeg',
          description: `Dokumentasi Piket: ${options.postName} oleh ${options.uploaderName} (${options.category}) - ${folderPath}`
        };
        const fallbackForm = new FormData();
        fallbackForm.append('metadata', new Blob([JSON.stringify(fallbackMetadata)], { type: 'application/json; charset=UTF-8' }));
        fallbackForm.append('file', imageBlob);
        res = await fetchWithTokenAutoRefresh(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink',
          { method: 'POST', body: fallbackForm },
          accessToken
        );
      }

      if (res.ok) {
        const driveData = await res.json();
        if (driveData.id) {
          driveFileId = driveData.id;
          realDriveUrl = driveData.webViewLink;
          webContentLink = driveData.webContentLink;
          console.log(`[GoogleDriveService] ✅ Foto terunggah ke Google Drive (Folder: ${targetFolderId})! (ID: ${driveData.id})`);
        }
      }
    } catch (driveErr) {
      console.warn('[GoogleDriveService] Direct upload error:', driveErr);
    }
  }

  const attachment: AttachmentMeta = {
    id: `att-meta-${Date.now()}`,
    driveFileId: driveFileId,
    fileName: fileName,
    folderPath: folderPath,
    mimeType: 'image/jpeg',
    size: compression.compressedSizeBytes,
    driveUrl: realDriveUrl || compression.dataUrl,
    thumbnailUrl: compression.dataUrl,
    uploadedBy: options.uploaderName,
    uploadedAt: new Date().toISOString(),
    entityType: options.entityType,
    entityId: options.entityId,
    isUploadedToDrive: !!realDriveUrl
  };

  try {
    const firestoreRef = doc(db, 'drive_attachments', attachment.id);
    await setDoc(
      firestoreRef,
      {
        ...attachment,
        realDriveUrl: realDriveUrl || null,
        webContentLink: webContentLink || null,
        originalSizeBytes: compression.originalSizeBytes,
        compressedSizeBytes: compression.compressedSizeBytes,
        originalSizeFormatted: compression.originalSizeFormatted,
        compressedSizeFormatted: compression.compressedSizeFormatted,
        savingsPercentage: compression.savingsPercentage,
        isUploadedToDrive: !!realDriveUrl,
        syncedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (fsErr) {
    console.warn('[GoogleDriveService] Save attachment metadata error:', fsErr);
  }

  return attachment;
};

export const uploadProfilePhotoToDrive = async (
  file: File | Blob | string,
  userName: string,
  arg3?: string,
  arg4?: string,
  accessToken?: string | null
): Promise<{ success: boolean; driveFileId?: string; webViewLink?: string; driveUrl?: string; message: string; compression?: CompressionResult }> => {
  let schoolName = 'Sekolah';
  let token = accessToken;

  if (typeof arg4 === 'string') {
    schoolName = arg4;
    token = accessToken;
  } else if (typeof arg3 === 'string') {
    schoolName = arg3;
  }

  token = token || (typeof window !== 'undefined' ? sessionStorage.getItem('epiket_drive_token') : null);

  const options: UploadFileOptions = {
    schoolName: schoolName || 'Sekolah',
    schoolYear: '2026-2027',
    semester: 'Ganjil',
    postName: 'Foto_Profil',
    uploaderName: userName,
    category: 'Profil',
    entityType: 'profile'
  };

  const att = await uploadToGoogleDrive(file, options, token);
  return {
    success: att.isUploadedToDrive ?? false,
    driveFileId: att.driveFileId,
    webViewLink: att.driveUrl,
    driveUrl: att.driveUrl,
    message: att.isUploadedToDrive ? 'Foto profil berhasil diunggah ke Google Drive!' : 'Foto profil tersimpan secara lokal.'
  };
};

export const uploadReportDocumentToDrive = async (
  pdfBlob: Blob,
  documentTitle: string,
  arg3?: string | null,
  arg4?: string | null,
  arg5?: string | null
): Promise<{ success: boolean; driveFileId?: string; webViewLink?: string; message: string }> => {
  let schoolName = 'Sekolah';
  let token: string | null = null;

  if (arg5) {
    schoolName = arg4 || 'Sekolah';
    token = arg5;
  } else if (arg4) {
    schoolName = arg3 || 'Sekolah';
    token = arg4;
  } else {
    schoolName = arg3 || 'Sekolah';
  }

  token = token || (typeof window !== 'undefined' ? sessionStorage.getItem('epiket_drive_token') : null);

  if (!token) {
    return {
      success: false,
      message: 'Google Drive belum terhubung. Silakan hubungkan Google Drive pada menu Pengaturan Sistem.'
    };
  }

  try {
    const cleanSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${documentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;

    const metadata = {
      name: fileName,
      mimeType: 'application/pdf',
      description: `Laporan Resmi Kedinasan e-Piket: ${documentTitle} - ${schoolName}`,
      parents: [DEFAULT_DRIVE_FOLDER_ID]
    };

    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const formBody = new FormData();
    formBody.append('metadata', metadataBlob);
    formBody.append('file', pdfBlob);

    const res = await fetchWithTokenAutoRefresh(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      { method: 'POST', body: formBody },
      token
    );

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        driveFileId: data.id,
        webViewLink: data.webViewLink,
        message: `Laporan PDF resmi berhasil diunggah ke Google Drive (${fileName})`
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        message: `Gagal mengunggah PDF ke Google Drive (Status ${res.status}): ${errText}`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Kendala unggah Laporan PDF ke Google Drive: ${err.message}`
    };
  }
};

export const autoSyncDatabaseToDrive = async (
  snapshotData: any,
  schoolName: string,
  accessToken?: string | null
): Promise<{ success: boolean; fileId?: string; message: string; lastSyncedAt: string }> => {
  const lastSyncedAt = new Date().toISOString();
  const token = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('epiket_drive_token') : null);

  if (!token) {
    return {
      success: false,
      message: 'Auto-sync Google Drive dinonaktifkan: Google Drive belum terhubung.',
      lastSyncedAt
    };
  }

  try {
    const cleanSchool = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `EPIKET_BACKUP_${cleanSchool}.json`;
    const jsonString = JSON.stringify(snapshotData, null, 2);
    const jsonBlob = new Blob([jsonString], { type: 'application/json; charset=UTF-8' });

    const searchQuery = encodeURIComponent(`name = '${fileName}' and trashed = false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${searchQuery}&fields=files(id,name)`;

    const searchRes = await fetchWithTokenAutoRefresh(searchUrl, { method: 'GET' }, token);

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const existingFile = searchData.files && searchData.files[0];

      if (existingFile) {
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
        const updateRes = await fetchWithTokenAutoRefresh(
          updateUrl,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: jsonBlob
          },
          token
        );

        if (updateRes.ok) {
          return {
            success: true,
            fileId: existingFile.id,
            message: `Auto-sync Google Drive aktif: Berkas cadangan diperbarui pada ${new Date().toLocaleTimeString('id-ID')}`,
            lastSyncedAt
          };
        }
      }
    }

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: `Pencadangan Otomatis Realtime Sistem e-Piket (${cleanSchool})`,
      parents: [DEFAULT_DRIVE_FOLDER_ID]
    };

    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const formBody = new FormData();
    formBody.append('metadata', metadataBlob);
    formBody.append('file', jsonBlob);

    const createRes = await fetchWithTokenAutoRefresh(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      { method: 'POST', body: formBody },
      token
    );

    if (createRes.ok) {
      const createData = await createRes.json();
      return {
        success: true,
        fileId: createData.id,
        message: `Auto-sync Google Drive aktif: File backup dibuat pada ${new Date().toLocaleTimeString('id-ID')}`,
        lastSyncedAt
      };
    }

    return {
      success: false,
      message: 'Gagal mengunggah auto-backup ke Google Drive.',
      lastSyncedAt
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Kendala jaringan auto-sync Drive: ${err.message}`,
      lastSyncedAt
    };
  }
};

export const listDrivePicketFiles = async (
  accessToken: string | null,
  pageSize = 30
): Promise<DriveFileInfo[]> => {
  const token = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('epiket_drive_token') : null);
  if (!token) return [];

  try {
    const query = encodeURIComponent("trashed = false");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=${pageSize}&fields=files(id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,createdTime,modifiedTime)&orderBy=createdTime desc`;

    const res = await fetchWithTokenAutoRefresh(url, { method: 'GET' }, token);

    if (res.ok) {
      const data = await res.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : undefined,
        webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
        webContentLink: f.webContentLink,
        thumbnailLink: f.thumbnailLink,
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime
      }));
    }
    return [];
  } catch (err) {
    console.warn('[GoogleDriveService] Failed to list files from Google Drive:', err);
    return [];
  }
};

export const deleteFromGoogleDrive = async (
  fileId: string,
  fileName: string,
  accessToken: string | null
): Promise<boolean> => {
  const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus file "${fileName}" dari Google Drive? Tindakan ini tidak dapat dibatalkan.`);
  if (!confirmed) return false;

  const token = accessToken || (typeof window !== 'undefined' ? sessionStorage.getItem('epiket_drive_token') : null);
  if (!token) {
    return true;
  }

  try {
    const res = await fetchWithTokenAutoRefresh(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      { method: 'DELETE' },
      token
    );
    return res.ok;
  } catch (err) {
    console.error('[GoogleDriveService] Failed to delete file from Google Drive:', err);
    return false;
  }
};
