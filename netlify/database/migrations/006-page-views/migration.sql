CREATE TABLE IF NOT EXISTS page_views (
  view_date DATE NOT NULL,
  path TEXT NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (view_date, path)
);

CREATE INDEX IF NOT EXISTS page_views_date_idx ON page_views(view_date DESC);
