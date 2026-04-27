-- Seed data for initial setup
-- Admin user: email=admin@wingert.local, password=admin123

INSERT INTO users (email, name, password_hash, role)
VALUES ('admin@wingert.local', 'Admin', '$2a$10$LNwVZex0EvJ7Xtcn.6Xzhuiiyty2d8yAzXBCgvTqwIQ2pQpCuu9KC', 'admin')
ON CONFLICT (email) DO NOTHING;

