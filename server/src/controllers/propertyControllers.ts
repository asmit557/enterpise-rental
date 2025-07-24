import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { wktToGeoJSON } from "@terraformer/wkt";
import { S3Client } from "@aws-sdk/client-s3";
import { Location } from "@prisma/client";
import { Upload } from "@aws-sdk/lib-storage";
import axios from "axios";

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const getProperties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      favoriteIds,
      priceMin,
      priceMax,
      beds,
      baths,
      propertyType,
      squareFeetMin,
      squareFeetMax,
      amenities,
      availableFrom,
      latitude,
      longitude,
    } = req.query;
    console.log("enter 1")
    console.log("Input coordinates:", latitude, longitude);
    console.log(availableFrom)


    let whereConditions: Prisma.Sql[] = [];

    if (favoriteIds) {
      const favoriteIdsArray = (favoriteIds as string).split(",").map(Number);
      whereConditions.push(
        Prisma.sql`p.id IN (${Prisma.join(favoriteIdsArray)})`
      );
    }

    if (priceMin) {
      whereConditions.push(
        Prisma.sql`p."pricePerMonth" >= ${Number(priceMin)}`
      );
    }

    if (priceMax) {
      whereConditions.push(
        Prisma.sql`p."pricePerMonth" <= ${Number(priceMax)}`
      );
    }

    if (beds && beds !== "any") {
      whereConditions.push(Prisma.sql`p.beds >= ${Number(beds)}`);
    }

    if (baths && baths !== "any") {
      whereConditions.push(Prisma.sql`p.baths >= ${Number(baths)}`);
    }

    if (squareFeetMin) {
      whereConditions.push(
        Prisma.sql`p."squareFeet" >= ${Number(squareFeetMin)}`
      );
    }

    if (squareFeetMax) {
      whereConditions.push(
        Prisma.sql`p."squareFeet" <= ${Number(squareFeetMax)}`
      );
    }

    if (propertyType && propertyType !== "any") {
      whereConditions.push(
        Prisma.sql`p."propertyType" = ${propertyType}::"PropertyType"`
      );
    }

  if (amenities && amenities !== "any") {
  const amenitiesArray = (amenities as string).split(",");
  const amenityList = amenitiesArray.map((a) => `'${a}'`).join(",");
  whereConditions.push(
    Prisma.sql`p.amenities @> ${Prisma.raw(`ARRAY[${amenityList}]::"Amenity"[]`)}`
  );
 }


    if (
  availableFrom &&
  availableFrom !== "any" &&
  typeof availableFrom === "string" &&
  !isNaN(Date.parse(availableFrom))
) {
  console.log("lasiugl")
  const date = new Date(availableFrom);
whereConditions.push(
  Prisma.sql`EXISTS (
    SELECT 1 FROM "Lease" lease 
    WHERE lease."propertyId" = p.id 
    AND lease."startDate" <= CAST(${date.toISOString()} AS timestamp)
  )`
);
    }

    console.log("done")

    if (latitude && longitude) {
      console.log("enter")
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const radiusInKilometers = 1000;
      const degrees = radiusInKilometers / 111; // Converts kilometers to degrees

      whereConditions.push(
        Prisma.sql`ST_DWithin(
          l.coordinates::geometry,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
          ${degrees}
        )`
      );
    }
    console.log("done 2")

    const completeQuery = Prisma.sql`
      SELECT 
        p.*,
        json_build_object(
          'id', l.id,
          'address', l.address,
          'city', l.city,
          'state', l.state,
          'country', l.country,
          'postalCode', l."postalCode",
          'coordinates', json_build_object(
            'longitude', ST_X(l."coordinates"::geometry),
            'latitude', ST_Y(l."coordinates"::geometry)
          )
        ) as location
      FROM "Property" p
      JOIN "Location" l ON p."locationId" = l.id
      ${
        whereConditions.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(whereConditions, " AND ")}`
          : Prisma.empty
      }
    `;
    console.log("done 3")

    const properties = await prisma.$queryRaw(completeQuery);
    console.log(properties)

    res.json(properties);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving properties: ${error.message}` });
  }
};

export const getProperty = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const property = await prisma.property.findUnique({
      where: { id: Number(id) },
      include: {
        location: true,
      },
    });

    if (property) {
      const coordinates: { coordinates: string }[] =
        await prisma.$queryRaw`SELECT ST_asText(coordinates) as coordinates from "Location" where id = ${property.location.id}`;

      const geoJSON: any = wktToGeoJSON(coordinates[0]?.coordinates || "");
      const longitude = geoJSON.coordinates[0];
      const latitude = geoJSON.coordinates[1];

      const propertyWithCoordinates = {
        ...property,
        location: {
          ...property.location,
          coordinates: {
            longitude,
            latitude,
          },
        },
      };
      res.json(propertyWithCoordinates);
    }
  } catch (err: any) {
    res
      .status(500)
      .json({ message: `Error retrieving property: ${err.message}` });
  }
};

export const createProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const {
      address,
      city,
      state,
      country,
      postalCode,
      managerCognitoId,
      ...propertyData
    } = req.body;

    // Upload images to S3
    const photoUrls = await Promise.all(
      files.map(async (file) => {
        const uploadParams = {
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: `properties/${Date.now()}-${file.originalname}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const uploadResult = await new Upload({
          client: s3Client,
          params: uploadParams,
        }).done();

        return uploadResult.Location;
      })
    );

    // Get coordinates from OpenStreetMap
    const fullAddress = `${address}, ${city}, ${state}, ${postalCode}, ${country}`;
    const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: fullAddress,
    format: "json",
    limit: "1",
}).toString()}`;

const geocodingResponse = await axios.get(geocodingUrl, {
  headers: {
    "User-Agent": "RealEstateApp (justsomedummyemail@gmail.com)",
  },
});

const [longitude, latitude] =
  geocodingResponse.data[0]?.lon && geocodingResponse.data[0]?.lat
    ? [
        parseFloat(geocodingResponse.data[0].lon),
        parseFloat(geocodingResponse.data[0].lat),
      ]
    : [0, 0];

    console.log('Geocoded coords:', longitude, latitude);
    // ✅ Step 1: Insert location using raw SQL to set geometry
    const [location] = await prisma.$queryRaw<Location[]>`
      INSERT INTO "Location" (address, city, state, country, "postalCode", coordinates)
      VALUES (${address}, ${city}, ${state}, ${country}, ${postalCode},
        ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
      RETURNING id, address, city, state, country, "postalCode", ST_AsText(coordinates) as coordinates;
    `;

    // ✅ Step 2: Create the property
    const newProperty = await prisma.property.create({
      data: {
        ...propertyData,
        locationId: location.id,
        photoUrls,
        managerCognitoId,
        amenities: typeof propertyData.amenities === "string" ? propertyData.amenities.split(",") : [],
        highlights: typeof propertyData.highlights === "string" ? propertyData.highlights.split(",") : [],
        isPetsAllowed: propertyData.isPetsAllowed === "true",
        isParkingIncluded: propertyData.isParkingIncluded === "true",
        pricePerMonth: parseFloat(propertyData.pricePerMonth),
        securityDeposit: parseFloat(propertyData.securityDeposit),
        applicationFee: parseFloat(propertyData.applicationFee),
        beds: parseInt(propertyData.beds),
        baths: parseFloat(propertyData.baths),
        squareFeet: parseInt(propertyData.squareFeet),
      },
      include: {
        location: true,
        manager: true,
      },
    });

    res.status(201).json(newProperty);
  } catch (err: any) {
    console.error("Error in createProperty:", err);
    res.status(500).json({ message: `Error creating property: ${err.message}` });
  }
};



export const getLeasesByPropertyId = async (req: Request, res: Response): Promise<void> => {
  try {
    const propertyId = parseInt(req.params.id);

    if (isNaN(propertyId)) {
      res.status(400).json({ message: "Invalid propertyId in params." });
    }

    const leases = await prisma.lease.findMany({
      where: {
        propertyId,
      },
      include: {
        tenant: true,       // include tenant details
        application: true,  // include related application (optional)
        payments: true,     // include all payment records
        property: true,     // include property info (optional)
      },
    });
    res.status(200).json(
      leases,
    );
  } catch (error) {
    console.error("Error fetching leases:", error);
    res.status(500).json({ message: "Server error while fetching leases." });
  }
};

