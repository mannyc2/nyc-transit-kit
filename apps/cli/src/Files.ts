/**
 * Downloads that land whole or not at all.
 */
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Sink from "effect/Sink"
import * as Stream from "effect/Stream"

export interface FileOutput<E, R> {
  readonly path: string
  readonly content: Stream.Stream<Uint8Array, E, R>
}

const partial = (path: string) => `${path}.partial`

/**
 * Streams each output into `<path>.partial` beside its destination, then
 * renames them all. A failed stream leaves no file behind and no destination touched.
 */
export const writeFiles = Effect.fn("Files.writeFiles")(function* <E, R>(
  outputs: ReadonlyArray<FileOutput<E, R>>
) {
  const fs = yield* FileSystem.FileSystem
  yield* Effect.forEach(
    outputs,
    ({ path, content }) => Stream.run(content, fs.sink(partial(path))),
    { discard: true }
  ).pipe(
    Effect.onError(() =>
      Effect.forEach(outputs, ({ path }) => fs.remove(partial(path), { force: true }), {
        discard: true
      }).pipe(Effect.ignore)
    )
  )
  return yield* Effect.forEach(outputs, ({ path }) =>
    fs.rename(partial(path), path).pipe(
      Effect.andThen(fs.stat(path)),
      Effect.map((info) => ({ path, bytes: Number(info.size) }))
    )
  )
})

/**
 * `--dry-run`: a FileSystem that writes nothing. Each output still drains its
 * stream, so the request behind it reaches the recording HttpClient.
 */
export const dryRun = FileSystem.layerNoop({ sink: () => Sink.drain })

export const textFile = (path: string, text: string): FileOutput<never, never> => ({
  path,
  content: Stream.encodeText(Stream.make(text))
})
