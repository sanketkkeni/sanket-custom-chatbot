const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || '';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const idToken = localStorage.getItem('idToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

async function apiRequest(method: string, path: string, body?: any): Promise<any> {
  const url = `${API_ENDPOINT}${path}`;
  const options: RequestInit = {
    method,
    headers: getAuthHeaders(),
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }
  return data;
}

// KB API
export async function listKBs(): Promise<any> {
  return apiRequest('GET', '/kbs');
}

export async function getKB(kbId: string): Promise<any> {
  return apiRequest('GET', `/kbs/${kbId}`);
}

export async function createKB(name: string): Promise<any> {
  return apiRequest('POST', '/kbs', { name });
}

export async function deleteKB(kbId: string): Promise<any> {
  return apiRequest('DELETE', `/kbs/${kbId}`);
}

export async function getUploadUrl(kbId: string, filename: string, contentType: string): Promise<any> {
  return apiRequest('POST', `/kbs/${kbId}/upload`, { filename, contentType });
}

export async function listFiles(kbId: string): Promise<any> {
  return apiRequest('GET', `/kbs/${kbId}/files`);
}

export async function deleteFile(kbId: string, fileKey: string): Promise<any> {
  return apiRequest('DELETE', `/kbs/${kbId}/files/${encodeURIComponent(fileKey)}`);
}

export async function startSync(kbId: string): Promise<any> {
  return apiRequest('POST', `/kbs/${kbId}/sync`);
}

export async function getSyncStatus(kbId: string): Promise<any> {
  return apiRequest('GET', `/kbs/${kbId}/sync`);
}

export async function getKBStats(kbId: string): Promise<any> {
  return apiRequest('GET', `/kbs/${kbId}/stats`);
}

// Chat API
export async function sendChat(kbId: string, message: string, agentId?: string, conversationId?: string): Promise<any> {
  return apiRequest('POST', '/chat', { kbId, message, agentId, conversationId });
}

// History API
export async function listConversations(search?: string): Promise<any> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest('GET', `/history${query}`);
}

export async function getConversation(conversationId: string): Promise<any> {
  return apiRequest('GET', `/history/${conversationId}`);
}

export async function deleteConversation(conversationId: string): Promise<any> {
  return apiRequest('DELETE', `/history/${conversationId}`);
}

// S3 direct upload
export async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });
  if (!response.ok) {
    throw new Error('Upload failed');
  }
}
