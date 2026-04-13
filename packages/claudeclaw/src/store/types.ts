/** Interface for reading/writing files and JSON to the data directory. */
export interface FileStore {
  /** Ensure the data directory and subdirectories exist. */
  init(): Promise<void>;

  /** Read a markdown file. Returns empty string if not found. */
  readMarkdown(filename: string): Promise<string>;

  /** Write a markdown file. */
  writeMarkdown(filename: string, content: string): Promise<void>;

  /** Read a JSON file. Returns fallback if not found. */
  readJson<T>(filename: string, fallback: T): Promise<T>;

  /** Write a JSON file. */
  writeJson<T>(filename: string, data: T): Promise<void>;

  /** List files in a subdirectory matching an extension. */
  listFiles(subdir: string, ext: string): Promise<string[]>;

  /** Get the absolute path to a file in the data directory. */
  resolve(filename: string): string;
}
