-- Banner de anúncio pago exibido uma vez para visitantes que não são staff (admin/mesário)

ALTER TABLE public.editions
  ADD COLUMN ad_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN ad_banner_url text,
  ADD COLUMN ad_whatsapp_phone text;
