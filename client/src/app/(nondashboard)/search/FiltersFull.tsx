import { FiltersState, initialState, setFilters } from "@/state";
import { useAppSelector } from "@/state/redux";
import { usePathname, useRouter } from "next/navigation";
import React from "react";
import { useDispatch } from "react-redux";
import { debounce } from "lodash";
import { cleanParams, cn, formatEnumString } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { AmenityIcons, PropertyTypeIcons } from "@/lib/constants";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const FiltersFull = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useAppSelector((state) => state.global.filters);
  const isFiltersFullOpen = useAppSelector(
    (state) => state.global.isFiltersFullOpen
  );

  const updateURL = debounce((newFilters: FiltersState) => {
    const cleanFilters = cleanParams(newFilters);
    const updatedSearchParams = new URLSearchParams();

    Object.entries(cleanFilters).forEach(([key, value]) => {
      updatedSearchParams.set(
        key,
        Array.isArray(value) ? value.join(",") : value.toString()
      );
    });

    router.push(`${pathname}?${updatedSearchParams.toString()}`);
  });

  const handleSubmit = () => {
    dispatch(setFilters(filters));
    updateURL(filters);
  };

  const handleReset = () => {
    dispatch(setFilters(initialState.filters));
    updateURL(initialState.filters);
  };

  const handleAmenityChange = (amenity: AmenityEnum) => {
    const updatedAmenities = filters.amenities.includes(amenity)
      ? filters.amenities.filter((a) => a !== amenity)
      : [...filters.amenities, amenity];

    dispatch(setFilters({ ...filters, amenities: updatedAmenities }));
  };

  const handleLocationSearch = async () => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          filters.location
        )}.json?access_token=${
          process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
        }&fuzzyMatch=true`
      );
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        dispatch(setFilters({ ...filters, coordinates: [lng, lat] }));
      }
    } catch (err) {
      console.error("Error search location:", err);
    }
  };

  if (!isFiltersFullOpen) return null;

  return (
    <div className="bg-white rounded-lg px-4 h-full overflow-auto pb-10">
      <div className="flex flex-col space-y-6">
        {/* Location */}
        <div>
          <h4 className="font-bold mb-2">Location</h4>
          <div className="flex items-center">
            <Input
              placeholder="Enter location"
              value={filters.location}
              onChange={(e) =>
                dispatch(setFilters({ ...filters, location: e.target.value }))
              }
              className="rounded-l-xl rounded-r-none border-r-0"
            />
            <Button
              onClick={handleLocationSearch}
              className="rounded-r-xl rounded-l-none border-l-none border-black shadow-none border hover:bg-primary-700 hover:text-primary-50"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Property Type */}
        <div>
          <h4 className="font-bold mb-2">Property Type</h4>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(PropertyTypeIcons).map(([type, Icon]) => (
              <div
                key={type}
                className={cn(
                  "flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer",
                  filters.propertyType === type
                    ? "border-black"
                    : "border-gray-200"
                )}
                onClick={() =>
                  dispatch(
                    setFilters({ ...filters, propertyType: type as PropertyTypeEnum })
                  )
                }
              >
                <Icon className="w-6 h-6 mb-2" />
                <span>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <h4 className="font-bold mb-2">Price Range (Monthly)</h4>
          <Slider
            min={0}
            max={10000}
            step={100}
            value={[ filters.priceRange[0] ?? 0,
              filters.priceRange[1] ?? 10000]}
            onValueChange={(value: any) =>
              dispatch(setFilters({ ...filters, priceRange: value }))
            }
          />
          <div className="flex justify-between mt-2">
            <span>${filters.priceRange[0] ?? 0}</span>
            <span>${filters.priceRange[1] ?? 10000}</span>
          </div>
        </div>

        {/* Beds and Baths */}
        <div className="flex gap-4">
          <div className="flex-1">
            <h4 className="font-bold mb-2">Beds</h4>
            <Select
              value={filters.beds || "any"}
              onValueChange={(value) =>
                dispatch(setFilters({ ...filters, beds: value }))
              }
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Beds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any beds</SelectItem>
                <SelectItem value="1">1+ bed</SelectItem>
                <SelectItem value="2">2+ beds</SelectItem>
                <SelectItem value="3">3+ beds</SelectItem>
                <SelectItem value="4">4+ beds</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <h4 className="font-bold mb-2">Baths</h4>
            <Select
              value={filters.baths || "any"}
              onValueChange={(value) =>
                dispatch(setFilters({ ...filters, baths: value }))
              }
            >
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Baths" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any baths</SelectItem>
                <SelectItem value="1">1+ bath</SelectItem>
                <SelectItem value="2">2+ baths</SelectItem>
                <SelectItem value="3">3+ baths</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Square Feet */}
        <div>
          <h4 className="font-bold mb-2">Square Feet</h4>
          <Slider
            min={0}
            max={5000}
            step={100}
            value={[ filters.squareFeet[0] ?? 0,
              filters.squareFeet[1] ?? 5000,]}
            onValueChange={(value: any) =>
              dispatch(setFilters({ ...filters, squareFeet: value }))
            }
            className="[&>.bar]:bg-primary-700"
          />
          <div className="flex justify-between mt-2">
            <span>{filters.squareFeet[0] ?? 0} sq ft</span>
            <span>{filters.squareFeet[1] ?? 5000} sq ft</span>
          </div>
        </div>

        {/* Amenities */}
        <div>
          <h4 className="font-bold mb-2">Amenities</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AmenityIcons).map(([amenity, Icon]) => (
              <div
                key={amenity}
                className={cn(
                  "flex items-center space-x-2 p-2 border rounded-lg hover:cursor-pointer",
                  filters.amenities.includes(amenity as AmenityEnum)
                    ? "border-black"
                    : "border-gray-200"
                )}
                onClick={() => handleAmenityChange(amenity as AmenityEnum)}
              >
                <Icon className="w-5 h-5 hover:cursor-pointer" />
                <Label className="hover:cursor-pointer">
                  {formatEnumString(amenity)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Available From */}
        <div>
          <h4 className="font-bold mb-2">Available From</h4>
          <Input
            type="date"
            value={filters.availableFrom !== "any" ? filters.availableFrom : ""}
            onChange={(e) =>
              dispatch(
                setFilters({
                  ...filters,
                  availableFrom: e.target.value || "any",
                })
              )
            }
            className="rounded-xl"
          />
        </div>

        {/* Apply and Reset buttons */}
        <div className="flex justify-center">
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex-1 rounded-xl"
          >
            Reset Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FiltersFull;
