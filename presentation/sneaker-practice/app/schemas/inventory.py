from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class SizeCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    size: Decimal = Field(gt=0, le=999, max_digits=4, decimal_places=1, allow_inf_nan=False)
    stock: int = Field(ge=0, le=2147483647, strict=True)


class SizePatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    size: Decimal | None = Field(default=None, gt=0, le=999, max_digits=4,
                                 decimal_places=1, allow_inf_nan=False)
    stock: int | None = Field(default=None, ge=0, le=2147483647, strict=True)

    @model_validator(mode='after')
    def require_changes(self):
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set
        ):
            raise ValueError('Provide size or stock; null is not allowed')
        return self
