declare namespace NodeJS {
  interface ProcessEnv {
    readonly GITHUB_PAGES?: string;
    readonly NEXT_PUBLIC_BASE_PATH?: string;
  }
}
