select
    cast("TerritoryID" as integer) as territory_id,
    cast("Name" as varchar) as name,
    cast("CountryRegionCode" as varchar) as country_region_code,
    cast("Group" as varchar) as territory_group,
    cast("ModifiedDate" as timestamp) as modified_date
from {{ source('snapshot', 'sales_territory') }}
