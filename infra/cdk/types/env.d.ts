declare namespace NodeJS {
    interface ProcessEnv {
        CDK_DEFAULT_ACCOUNT: string;
        CDK_DEFAULT_REGION: string;
        PORT?: string; // optional
        NODE_ENV: "development" | "production" | "test";
    }
}
