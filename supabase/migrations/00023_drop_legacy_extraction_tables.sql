-- Migration: Drop legacy extraction tables
--
-- The old extraction path (clients → client_criteria → extraction_lists → list_properties)
-- has been replaced by the new searches-based path (searches → search_properties).
--
-- This migration removes the old tables that are no longer used.

-- Drop views that depend on old tables
DROP VIEW IF EXISTS client_pipeline_summary;

-- Drop foreign key columns that reference the old tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sequences' AND column_name = 'extraction_list_id') THEN
        ALTER TABLE sequences DROP COLUMN extraction_list_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_packages' AND column_name = 'extraction_list_id') THEN
        ALTER TABLE deal_packages DROP COLUMN extraction_list_id;
    END IF;
END $$;

-- Drop junction table first (depends on extraction_lists)
DROP TABLE IF EXISTS list_properties;

-- Drop extraction_lists (depends on client_criteria)
DROP TABLE IF EXISTS extraction_lists;

-- Drop client_criteria (depends on clients)
DROP TABLE IF EXISTS client_criteria;

-- Drop clients table
DROP TABLE IF EXISTS clients;

-- Clean up any orphaned indexes that might exist
DROP INDEX IF EXISTS idx_list_properties_extraction_list;
DROP INDEX IF EXISTS idx_list_properties_property;
DROP INDEX IF EXISTS idx_extraction_lists_criteria;
DROP INDEX IF EXISTS idx_extraction_lists_status;
DROP INDEX IF EXISTS idx_client_criteria_client;
DROP INDEX IF EXISTS idx_client_criteria_status;
DROP INDEX IF EXISTS idx_clients_name;
DROP INDEX IF EXISTS idx_clients_status;
