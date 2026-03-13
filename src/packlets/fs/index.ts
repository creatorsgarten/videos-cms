import { get, set } from 'idb-keyval'

const IDB_KEY = 'videos-dir-handle'

export async function openDirectory(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await set(IDB_KEY, handle)
  return handle
}

export async function loadPersistedDirectory(): Promise<FileSystemDirectoryHandle | null> {
  // Allow E2E tests to inject a mock handle without triggering showDirectoryPicker
  const mock = (window as any).__mockDirectoryHandle as
    | FileSystemDirectoryHandle
    | undefined
  if (mock) return mock

  const handle = await get<FileSystemDirectoryHandle>(IDB_KEY)
  return handle ?? null
}

export async function checkPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'readwrite' })
}

export async function requestPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  return handle.requestPermission({ mode: 'readwrite' })
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  let state = await checkPermission(handle)
  if (state === 'prompt') {
    state = await requestPermission(handle)
  }
  return state === 'granted'
}

export async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile()
  return file.text()
}

export async function writeFile(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}
