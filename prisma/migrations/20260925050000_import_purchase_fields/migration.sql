ALTER TABLE "Purchase"
  ADD COLUMN "foreignAmount" DECIMAL(18,2),
  ADD COLUMN "customsDate" DATE,
  ADD COLUMN "customsExchangeRate" DECIMAL(12,4),
  ADD COLUMN "baseAmount" DECIMAL(18,0),
  ADD COLUMN "importVatBaseAmount" DECIMAL(18,0),
  ADD COLUMN "importVat" DECIMAL(18,0);

ALTER TABLE "Purchase"
  ADD CONSTRAINT "Purchase_customsExchangeRate_nonnegative"
    CHECK ("customsExchangeRate" IS NULL OR "customsExchangeRate" > 0),
  ADD CONSTRAINT "Purchase_foreignAmount_nonnegative"
    CHECK ("foreignAmount" IS NULL OR "foreignAmount" >= 0),
  ADD CONSTRAINT "Purchase_baseAmount_nonnegative"
    CHECK ("baseAmount" IS NULL OR "baseAmount" >= 0),
  ADD CONSTRAINT "Purchase_importVatBaseAmount_nonnegative"
    CHECK ("importVatBaseAmount" IS NULL OR "importVatBaseAmount" >= 0),
  ADD CONSTRAINT "Purchase_importVat_nonnegative"
    CHECK ("importVat" IS NULL OR "importVat" >= 0);
