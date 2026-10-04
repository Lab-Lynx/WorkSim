process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/worksim_test';
process.env.ACCESS_TOKEN_SECRET ??= 'test_access_token_secret_placeholder_at_least_32_chars';
process.env.REFRESH_TOKEN_SECRET ??= 'test_refresh_token_secret_placeholder_at_least_32_chars';
process.env.CLIENT_URL ??= 'http://localhost:5173';
process.env.CHAPA_SECRET_KEY ??= 'test_chapa_secret_key';
process.env.CHAPA_WEBHOOK_SECRET ??= 'test_chapa_webhook_secret';
process.env.CHAPA_RETURN_URL ??= 'http://localhost:5173/subscription/return';
process.env.GITHUB_CLIENT_ID ??= 'test_github_client_id';
process.env.GITHUB_CLIENT_SECRET ??= 'test_github_client_secret';
process.env.GITHUB_CALLBACK_URL ??= 'http://localhost:3000/api/v1/github/callback';
process.env.GITHUB_TOKEN_ENCRYPTION_KEY ??= 'test_encryption_key_placeholder_32_bytes_len!';
process.env.GITHUB_WEBHOOK_SECRET ??= 'test_github_webhook_secret_here';
process.env.GITHUB_REQUESTED_SCOPE = 'write:repo_hook';
process.env.GEMINI_API_KEY ??= 'test_gemini_api_key';
process.env.GROQ_API_KEY ??= 'test_groq_api_key';

