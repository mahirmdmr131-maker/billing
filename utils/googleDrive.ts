
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; 
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.email';

let accessToken: string | null = null;

export const initGoogleAuth = (onSuccess: (token: string, email?: string) => void) => {
  const client = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (response: any) => {
      if (response.access_token) {
        accessToken = response.access_token;
        
        // Fetch email for display
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
};

export const listDriveFolders = async (): Promise<{id: string, name: string}[]> => {
  if (!accessToken) return [];
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await response.json();
    return data.files || [];
  } catch (e) {
    return [];
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
    return false;
  }
};
