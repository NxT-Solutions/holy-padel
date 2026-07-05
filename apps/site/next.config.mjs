const repositoryName = "holy-padel";
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const basePath = isGitHubPages ? `/${repositoryName}` : "";
const workspaceRoot = new URL("../../", import.meta.url).pathname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath === "" ? undefined : `${basePath}/`,
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
