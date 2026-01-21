
const CLIENT_ID = 'YOUR_ONEDRIVE_CLIENT_ID'; // Placeholder for user
const SCOPES = 'Files.ReadWrite User.Read';

let odAccessToken: string | null = null;

export const initOneDriveAuth = (onSuccess: (token: string) => void) => {
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(window.location.origin)}&scope=${encodeURIComponent(SCOPES)}`;
  
  const width = 600;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  
  const authWindow = window.open(authUrl, 'OneDrive Login', `width=${width},height=${height},left=${left},top=${top}`);

  const interval = setInterval(() => {
    try {
      if (authWindow?.location.hash) {
        const hash = authWindow.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        if (token) {
          odAccessToken = token;
          onSuccess(token);
          authWindow.close();
          clearInterval(interval);
        }
      }
    } catch (e) {
      // Cross-origin check might fail until redirect happens
    }
    if (authWindow?.closed) {
      clearInterval(interval);
    }
  }, 500);
};

export const uploadToOneDrive = async (data: any, folderName: string): Promise<boolean> => {
  if (!odAccessToken) return false;

  try {
    const fileName = 'AM_Food_Manager_Backup.json';
    const fileContent = JSON.stringify(data);
    
    // Upload endpoint (automatically handles folder creation if using path based approach)
    // Note: MS Graph path-based PUT creates folders if they don't exist
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(folderName)}/${fileName}:/content`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${odAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: fileContent,
    });

    return response.ok;
  } catch (error) {
    console.error('OneDrive Upload Error:', error);
    return false;
  }
};
