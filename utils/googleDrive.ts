const CLIENT_ID = '501480422031-a2esiqv1htk6jis1uamukfiietaqj29j.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email';

const TOKEN_STORAGE_KEY = 'am_food_drive_token';
const EXPIRY_STORAGE_KEY = 'am_food_drive_expiry';
const EMAIL_STORAGE_KEY = 'am_food_drive_email';

let accessToken: string | null = null;
const AUTHORIZED_EMAIL = 'amfoodsupt@gmail.com';

/**
 * Checks URL hash/search for OAuth token after redirect from Google Sign-In
 */
export const checkUrlForOAuthToken = async (onSuccess?: (token: string, email: string) => void) => {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    
    const token = hashParams.get('access_token') || searchParams.get('access_token');
    const expiresIn = parseInt(hashParams.get('expires_in') || searchParams.get('expires_in') || '3600', 10);

    if (token) {
      // Clear URL params without reloading page
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname);
      }

      let email = '';
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profileData = await profileRes.json();
        email = profileData.email || '';
      } catch (e) {
        console.warn("OAuth userinfo check failed:", e);
      }

      if (email && email.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
        accessToken = null;
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        alert(`Access denied for ${email}. Access restricted to ${AUTHORIZED_EMAIL}.`);
        return null;
      }

      savePersistedToken(token, expiresIn, email || AUTHORIZED_EMAIL);
      if (onSuccess) onSuccess(token, email || AUTHORIZED_EMAIL);
      return token;
    }
  } catch (err) {
    console.error("Error parsing OAuth URL token:", err);
  }
  return null;
};

// Immediately check URL on module load
checkUrlForOAuthToken();

/**
 * Loads a persisted token from local storage if it hasn't expired.
 */
const loadPersistedToken = () => {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(EXPIRY_STORAGE_KEY);
  
  if (storedToken && expiry) {
    const expiryTime = parseInt(expiry, 10);
    // Use token if it has at least 5 minutes left
    if (Date.now() < (expiryTime - 300000)) {
      accessToken = storedToken;
      return true;
    }
  }
  return false;
};

/**
 * Saves the token and expiry to local storage.
 */
const savePersistedToken = (token: string, expiresInSeconds: number, email: string) => {
  const expiryTime = Date.now() + (expiresInSeconds * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(EXPIRY_STORAGE_KEY, expiryTime.toString());
  localStorage.setItem(EMAIL_STORAGE_KEY, email);
  accessToken = token;
};

const ensureGisLoaded = (timeout = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if ((window as any).google?.accounts) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error("Google Identity Services timed out."));
      }
    }, 100);
  });
};

export const triggerOAuthRedirect = () => {
  const redirectUri = window.location.origin + window.location.pathname;
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&prompt=select_account`;
  
  window.location.href = oauthUrl;
};

export const initGoogleAuth = async (onSuccess: (token: string, email?: string) => void, autoConnect = false) => {
  try {
    if (loadPersistedToken()) {
      onSuccess(accessToken!, localStorage.getItem(EMAIL_STORAGE_KEY) || AUTHORIZED_EMAIL);
      return;
    }

    try {
      await ensureGisLoaded(3000); // Wait max 3 seconds for GIS
    } catch (gisErr) {
      console.warn("GIS unavailable or timed out, falling back to direct OAuth redirect:", gisErr);
      if (!autoConnect) {
        triggerOAuthRedirect();
      }
      return;
    }

    if ((window as any).google?.accounts?.oauth2) {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            console.warn("GIS error callback, attempting direct OAuth redirect:", response);
            if (!autoConnect) triggerOAuthRedirect();
            return;
          }
          if (response.access_token) {
            const tempToken = response.access_token;
            let email = '';
            try {
              const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${tempToken}` }
              });
              const profileData = await profileRes.json();
              email = profileData.email;
            } catch (e) {
              console.warn("Identity check failed", e);
            }
            
            if (email && email.toLowerCase() !== AUTHORIZED_EMAIL.toLowerCase()) {
              accessToken = null;
              localStorage.removeItem(TOKEN_STORAGE_KEY);
              if (!autoConnect) alert(`Access denied for ${email}. Access restricted to ${AUTHORIZED_EMAIL}.`);
              return;
            }

            savePersistedToken(tempToken, response.expires_in, email || AUTHORIZED_EMAIL);
            onSuccess(tempToken, email || AUTHORIZED_EMAIL);
          }
        },
        error_callback: () => {
          if (!autoConnect) triggerOAuthRedirect();
        }
      });
      
      if (autoConnect) {
        const hint = localStorage.getItem(EMAIL_STORAGE_KEY) || AUTHORIZED_EMAIL;
        client.requestAccessToken({ prompt: '', login_hint: hint });
      } else {
        client.requestAccessToken({ prompt: 'select_account' });
      }
    } else if (!autoConnect) {
      triggerOAuthRedirect();
    }
  } catch (err: any) {
    console.error("GIS Error:", err);
    if (!autoConnect) {
      triggerOAuthRedirect();
    }
  }
};

export const hasAccessToken = () => {
  if (accessToken) return true;
  return loadPersistedToken();
};

const getOrCreateFolder = async (folderName: string): Promise<string | null> => {
  if (!hasAccessToken()) return null;
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchRes.status === 401) { 
        accessToken = null; 
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null; 
    }
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
    });
    const createData = await createRes.json();
    return createData.id || null;
  } catch (e) {
    return null;
  }
};

export const getBackupInfo = async (folderName: string): Promise<{ id: string; modifiedTime: string } | null> => {
  if (!hasAccessToken()) return null;
  try {
    const parentFolderId = await getOrCreateFolder(folderName);
    const fileName = 'AM_Food_Manager_Backup.json';
    const query = `name='${fileName}'${parentFolderId ? ` and '${parentFolderId}' in parents` : ''} and trashed=false`;
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, modifiedTime)&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchResponse.status === 401) { 
        accessToken = null; 
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null; 
    }
    const searchResult = await searchResponse.json();
    if (searchResult.files && searchResult.files.length > 0) {
      return { id: searchResult.files[0].id, modifiedTime: searchResult.files[0].modifiedTime };
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const downloadFromDrive = async (fileId: string): Promise<any | null> => {
  if (!hasAccessToken()) return null;
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 401) { 
        accessToken = null; 
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null; 
    }
    return await response.json();
  } catch (error) {
    return null;
  }
};

export const uploadToDrive = async (data: any, folderName: string): Promise<boolean> => {
  if (!hasAccessToken()) return false;
  try {
    const parentFolderId = await getOrCreateFolder(folderName);
    const fileName = 'AM_Food_Manager_Backup.json';
    const query = `name='${fileName}'${parentFolderId ? ` and '${parentFolderId}' in parents` : ''} and trashed=false`;
    
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (searchResponse.status === 401) { 
        accessToken = null; 
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return false; 
    }
    const searchResult = await searchResponse.json();
    const existingFile = searchResult.files && searchResult.files[0];

    const metadata = { 
      name: fileName, 
      mimeType: 'application/json', 
      parents: existingFile ? undefined : (parentFolderId ? [parentFolderId] : []) 
    };

    const fileContent = JSON.stringify(data);
    const boundary = 'am_food_boundary';
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      '\r\n',
      delimiter,
      'Content-Type: application/json\r\n\r\n',
      fileContent,
      closeDelimiter
    ].join('');

    const url = existingFile 
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const response = await fetch(url, {
      method: existingFile ? 'PATCH' : 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    if (response.status === 401) { 
        accessToken = null; 
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return false; 
    }
    return response.ok;
  } catch (error) {
    console.error('Drive Upload Error:', error);
    return false;
  }
};