-- Seed data for initial setup
-- Admin user: admin@wingert.local (password set via ADMIN_PASSWORD_HASH env var or update manually)

INSERT INTO users (email, name, password_hash, role)
VALUES ('admin@wingert.local', 'Admin', '$2a$10$LNwVZex0EvJ7Xtcn.6Xzhuiiyty2d8yAzXBCgvTqwIQ2pQpCuu9KC', 'admin')
ON CONFLICT (email) DO NOTHING;

