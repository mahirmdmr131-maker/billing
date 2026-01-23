const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email';

let accessToken: string | null = null;

/**
 * Ensures the Google Identity Services (GIS) library is loaded.
 * It polls for window.google.accounts to handle cases where the script 
 * is still initializing due to its async/defer nature.
 */
const ensureGisLoaded = (timeout = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts) {
      resolve();
      return;
    }

    // If script isn't in DOM, add it (safety fallback)
    if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if ((window as any).google?.accounts) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error("Google Identity Services timed out. Please check your internet connection and try again."));
      }
    }, 100);
  });
};

export const initGoogleAuth = async (onSuccess: (token: string, email?: string) => void) => {
  try {
    await ensureGisLoaded();

    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response: any) => {
        if (response.access_token) {
          accessToken = response.access_token;
          
          let email = '';
          try {
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            const profileData = await profileRes.json();
            email = profileData.email;
          } catch (e) {
            console.warn("Failed to fetch user email", e);
          }
          
          onSuccess(response.access_token, email);
        }
      },
    });
    client.requestAccessToken();
  } catch (err: any) {
    console.error("GIS Initialization Error:", err);
    alert(err.message || "Failed to initialize Google Authentication.");
  }
};

const getOrCreateFolder = async (folderName: string): Promise<string | null> => {
  if (!accessToken) return null;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const createData = await createRes.json();
  return createData.id || null;
};

export const getBackupInfo = async (folderName: string): Promise<{ id: string; modifiedTime: string } | null> => {
  if (!accessToken) return null;
  try {
    const parentFolderId = await getOrCreateFolder(folderName);
    const fileName = 'AM_Food_Manager_Backup.json';
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'${parentFolderId ? ` and '${parentFolderId}' in parents` : ''} and trashed=false&fields=files(id, modifiedTime)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchResult = await searchResponse.json();
    if (searchResult.files && searchResult.files.length > 0) {
      return {
        id: searchResult.files[0].id,
        modifiedTime: searchResult.files[0].modifiedTime
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching backup info:', error);
    return null;
  }
};

export const downloadFromDrive = async (fileId: string): Promise<any | null> => {
  if (!accessToken) return null;
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) throw new Error('Failed to download file');
    return await response.json();
  } catch (error) {
    console.error('Drive Download Error:', error);
    return null;
  }
};

export const uploadToDrive = async (data: any, folderName: string): Promise<boolean> => {
  if (!accessToken) return false;
  try {
    const parentFolderId = await getOrCreateFolder(folderName);
    const fileName = 'AM_Food_Manager_Backup.json';
    const metadata = { name: fileName, mimeType: 'application/json', parents: parentFolderId ? [parentFolderId] : [] };

    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'${parentFolderId ? ` and '${parentFolderId}' in parents` : ''} and trashed=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchResult = await searchResponse.json();
    const existingFile = searchResult.files && searchResult.files[0];

    const fileContent = JSON.stringify(data);
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + delimiter + 'Content-Type: application/json\r\n\r\n' +
      fileContent + closeDelimiter;

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';
    if (existingFile) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
      method = 'PATCH';
    }
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartRequestBody,
    });
    return response.ok;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    return false;
  }
};