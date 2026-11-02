import { readdir } from "node:fs/promises"
import { join } from "node:path"

export const rootPath = new URL("../", import.meta.url).pathname

/** Every app and package, by its path from the root: `apps/cli`, `packages/soda3`. */
export const workspaceDirectories = async () => {
  const directories = await Promise.all(
    ["apps", "packages"].map(async (root) =>
      (await readdir(join(rootPath, root), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${root}/${entry.name}`)
    )
  )
  return directories.flat().toSorted()
}
