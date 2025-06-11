import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import sharp from "sharp";

interface RequestBody {
  category: string;
  subtitle: string;
  description: string;
  tags: string[];
  imageNames: string[];
  imgAlts: string[];
  publishDate: string;
  title: string;
  images: string[]; // Base64 encoded images
}

export async function POST(request: Request) {
  try {
    // Debug logs para variables de entorno
    console.log("🔍 Verificando variables de entorno:");
    console.log(
      "GITHUB_TOKEN:",
      process.env.GITHUB_TOKEN ? "✅ Presente" : "❌ Faltante"
    );
    console.log(
      "GITHUB_REPO:",
      process.env.GITHUB_REPO ? "✅ Presente" : "❌ Faltante"
    );
    console.log(
      "GITHUB_BRANCH:",
      process.env.GITHUB_BRANCH ? "✅ Presente" : "❌ Faltante"
    );

    console.log("📥 Recibiendo request...");
    const body: RequestBody = await request.json();
    console.log("📦 Datos recibidos:", {
      category: body.category,
      subtitle: body.subtitle,
      imagesCount: body.images?.length || 0,
      tagsCount: body.tags?.length || 0,
    });

    const {
      category,
      subtitle,
      description,
      tags,
      imageNames,
      imgAlts,
      publishDate,
      title,
      images,
    } = body;

    if (!process.env.GITHUB_TOKEN) {
      console.error("❌ GitHub token no configurado");
      return NextResponse.json(
        { error: "GitHub token not configured" },
        { status: 500 }
      );
    }

    if (!process.env.GITHUB_REPO || !process.env.GITHUB_BRANCH) {
      console.error("❌ Configuración de GitHub incompleta");
      return NextResponse.json(
        { error: "GitHub repository configuration missing" },
        { status: 500 }
      );
    }

    if (!images || images.length === 0) {
      console.error("❌ No se recibieron imágenes");
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const owner = "agusalta";
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;
    const basePath = "src/content/work";
    const categoryKebab = category.toLowerCase().replace(/\s+/g, "-");
    const assetsPath = `/assets/${categoryKebab}`;

    console.log("📁 Configuración de rutas:", {
      basePath,
      categoryKebab,
      assetsPath,
    });

    const createdFiles: string[] = [];

    // Verificar que la carpeta de assets existe
    try {
      await octokit.repos.getContent({
        owner,
        repo,
        path: "public/assets",
        ref: branch,
      });
    } catch (error) {
      console.error("❌ La carpeta public/assets no existe en el repositorio");
      return NextResponse.json(
        { error: "Assets directory not found in repository" },
        { status: 500 }
      );
    }

    // Verificar si existe la carpeta de la categoría
    try {
      await octokit.repos.getContent({
        owner,
        repo,
        path: assetsPath,
        ref: branch,
      });
    } catch (error) {
      console.log(
        `📁 La carpeta ${assetsPath} no existe, se creará con las imágenes`
      );
    }

    // Procesar y subir cada imagen
    for (let i = 0; i < images.length; i++) {
      const imageNumber = (i + 1).toString();
      const imagePath = `${assetsPath}/${imageNumber}.webp`;

      try {
        console.log(`🖼️ Procesando imagen ${imageNumber}...`);

        // Convertir la imagen a WebP
        const imageBuffer = Buffer.from(
          images[i].replace(/^data:image\/\w+;base64,/, ""),
          "base64"
        );
        console.log(`📦 Tamaño del buffer: ${imageBuffer.length} bytes`);

        // Verificar el formato de la imagen
        const metadata = await sharp(imageBuffer).metadata();
        console.log(
          `📊 Formato de imagen: ${metadata.format}, Dimensiones: ${metadata.width}x${metadata.height}`
        );

        const webpBuffer = await sharp(imageBuffer)
          .webp({ quality: 80 })
          .toBuffer();
        console.log(
          `✅ Imagen ${imageNumber} convertida a WebP (${webpBuffer.length} bytes)`
        );

        // Obtener el SHA del archivo si existe
        let fileSha: string | undefined;
        try {
          const existingFile = await octokit.repos.getContent({
            owner,
            repo,
            path: imagePath,
            ref: branch,
          });
          if (!Array.isArray(existingFile.data)) {
            fileSha = existingFile.data.sha;
          }
        } catch (error) {
          // El archivo no existe, continuamos sin SHA
          console.log(`📝 Archivo ${imagePath} no existe, se creará nuevo`);
        }

        // Subir la imagen WebP
        console.log(`📤 Subiendo imagen ${imageNumber} a ${imagePath}...`);
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: imagePath,
          message: `Add image ${imageNumber} for ${categoryKebab}`,
          content: webpBuffer.toString("base64"),
          branch,
          ...(fileSha && { sha: fileSha }),
        });
        console.log(`✅ Imagen ${imageNumber} subida exitosamente`);
      } catch (error: any) {
        console.error(
          `❌ Error procesando imagen ${imageNumber}:`,
          error.message
        );
        if (error.message) {
          console.error(`Mensaje de error: ${error.message}`);
        }
        if (error.response) {
          console.error("Respuesta de GitHub:", error.response.data);
        }
        return NextResponse.json(
          {
            error: `Failed to process image ${imageNumber}`,
            details: error.message || "Unknown error",
          },
          { status: 500 }
        );
      }
    }

    // Crear un archivo Markdown para cada imagen
    for (let i = 0; i < images.length; i++) {
      const imgAlt = imgAlts[i];
      const fileNumber = (i + 1).toString();
      const categoryPrefix = category.substring(0, 2).toUpperCase();
      const fileName = `PG${categoryPrefix}${fileNumber}.md`;
      const filePath = `${basePath}/${fileName}`;
      const imageNumber = (i + 1).toString();
      const imagePath = `${assetsPath}/${imageNumber}.webp`;

      const content = [
        "---",
        `title: "${title}"`,
        subtitle ? `subtitle: "${subtitle}"` : null,
        `category: ${category}`,
        `publishDate: ${publishDate}`,
        `img: ${imagePath}`,
        `img_alt: "${imgAlt}"`,
        "tags:",
        ...tags.map((tag) => `  - ${tag}`),
        "---",
        "",
        description,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        // Obtener el SHA del archivo si existe
        let fileSha: string | undefined;
        try {
          const existingFile = await octokit.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: branch,
          });
          if (!Array.isArray(existingFile.data)) {
            fileSha = existingFile.data.sha;
          }
        } catch (error) {
          // El archivo no existe, continuamos sin SHA
          console.log(`📝 Archivo ${filePath} no existe, se creará nuevo`);
        }

        // Crear el archivo Markdown
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message: `Add ${fileName}`,
          content: Buffer.from(content).toString("base64"),
          branch,
          ...(fileSha && { sha: fileSha }),
        });
        createdFiles.push(fileName);
      } catch (error: any) {
        console.error(`Error creating file ${fileName}:`, error.message);
        return NextResponse.json(
          { error: `Failed to create file ${fileName}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      status: "success",
      files: createdFiles,
      assetsPath,
    });
  } catch (error: any) {
    console.error("❌ Error general:", error);
    console.error("Stack trace:", error.stack);
    if (error.response) {
      console.error("Respuesta de GitHub:", error.response.data);
    }
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error.message || "Unknown error",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
