import type {NextConfig} from 'next';
const config: NextConfig = {transpilePackages: ['@lumi/shared'], async headers() {return [{source:'/:path*',headers:[{key:'X-Lumi-App',value:'lumi-wpp-bot'}]}];}};
export default config;
