-- Initialize databases for Invy
-- This script runs automatically on first container startup

-- Create blnk database for Blnk ledger service
CREATE DATABASE blnk;
GRANT ALL PRIVILEGES ON DATABASE blnk TO invy_admin;
