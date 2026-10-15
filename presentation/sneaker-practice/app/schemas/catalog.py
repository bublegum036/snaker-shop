from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

class ProductWrite(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=120)
    brand_id: int = Field(gt=0, le=2147483647)
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2, allow_inf_nan=False)
    description: str = Field(default='', max_length=2000)
    image_url: HttpUrl | None = None

    @field_validator('name')
    @classmethod
    def nonblank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('Name must not be blank')
        return value

class ProductUpdate(ProductWrite):
    version: int = Field(gt=0, le=2147483647)

class BrandRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str

class SizeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    size: Decimal
    stock: int

class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    version: int
    id: int
    name: str
    brand_id: int
    price: Decimal
    description: str
    image_url: str | None
    sizes: list[SizeRead]
