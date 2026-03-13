import type { Page } from '@playwright/test'

type FileTree = Record<string, string> // path -> contents

/**
 * Builds a mock FileSystemDirectoryHandle from a flat path→contents map
 * and injects it as window.__mockDirectoryHandle.
 */
export async function injectDirectoryHandle(
  page: Page,
  files: FileTree,
): Promise<void> {
  await page.addInitScript((files: FileTree) => {
    function makeFileHandle(name: string, contents: string): FileSystemFileHandle {
      return {
        kind: 'file',
        name,
        queryPermission: async () => 'granted' as PermissionState,
        requestPermission: async () => 'granted' as PermissionState,
        getFile: async () => new File([contents], name, { type: 'text/plain' }),
        createWritable: async () => {
          let data = ''
          return {
            write: async (chunk: string) => { data += chunk },
            close: async () => {
              ;(window as any).__writes ??= {}
              ;(window as any).__writes[name] = data
            },
            abort: async () => {},
          } as unknown as FileSystemWritableFileStream
        },
        isSameEntry: async () => false,
      } as unknown as FileSystemFileHandle
    }

    function makeDirectoryHandle(
      name: string,
      entries: Record<string, any>,
    ): FileSystemDirectoryHandle {
      return {
        kind: 'directory',
        name,
        queryPermission: async () => 'granted' as PermissionState,
        requestPermission: async () => 'granted' as PermissionState,
        getDirectoryHandle: async (child: string) => {
          const node = entries[child]
          if (!node || node.kind !== 'directory') throw new Error(`Not a directory: ${child}`)
          return makeDirectoryHandle(child, node.entries)
        },
        getFileHandle: async (child: string, options?: { create?: boolean }) => {
          const node = entries[child]
          if (node?.kind === 'file') return makeFileHandle(child, node.contents)
          if (options?.create) return makeFileHandle(child, '')
          throw new Error(`Not a file: ${child}`)
        },
        entries: async function* () {
          for (const [k, v] of Object.entries(entries) as any) {
            if (v.kind === 'file') yield [k, makeFileHandle(k, v.contents)]
            else yield [k, makeDirectoryHandle(k, v.entries)]
          }
        },
        isSameEntry: async () => false,
      } as unknown as FileSystemDirectoryHandle
    }

    // Build nested tree from flat path map
    const root: Record<string, any> = {}
    for (const [filePath, contents] of Object.entries(files)) {
      const parts = filePath.split('/')
      let node = root
      for (let i = 0; i < parts.length - 1; i++) {
        node[parts[i]] ??= { kind: 'directory', entries: {} }
        node = node[parts[i]].entries
      }
      node[parts[parts.length - 1]] = { kind: 'file', contents }
    }

    ;(window as any).__mockDirectoryHandle = makeDirectoryHandle('videos', root)
  }, files)
}
