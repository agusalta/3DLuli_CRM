"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { Calendar, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

interface ProjectFormData {
  title: string;
  subtitle: string;
  category: string;
  publishDate: Date | undefined;
  images: File[];
  imageAlt: string;
  description: string;
  tags: string;
}

export default function Component() {
  const [formData, setFormData] = useState<ProjectFormData>({
    title: "",
    subtitle: "",
    category: "",
    publishDate: undefined,
    images: [],
    imageAlt: "",
    description: "",
    tags: "",
  });

  const [markdownPreview, setMarkdownPreview] = useState("");

  // Generate markdown preview whenever form data changes
  useEffect(() => {
    generateMarkdownPreview();
  }, [formData]);

  const generateMarkdownPreview = () => {
    const tagsArray = formData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);

    const frontmatter = [
      "---",
      `title: "${formData.title}"`,
      formData.subtitle ? `subtitle: "${formData.subtitle}"` : null,
      `category: ${formData.category || ""}`,
      formData.publishDate
        ? `publishDate: ${format(formData.publishDate, "yyyy-MM-dd")} 00:00:00`
        : "publishDate: ",
      `image: ${formData.images.length > 0 ? formData.images[0].name : ""}`,
      `alt: "${formData.imageAlt}"`,
      tagsArray.length > 0 ? "tags:" : "tags: []",
      ...tagsArray.map((tag) => `  - ${tag}`),
      "---",
      "",
      formData.description || "Description goes here...",
    ]
      .filter(Boolean)
      .join("\n");

    setMarkdownPreview(frontmatter);
  };

  const handleInputChange = (
    field: keyof ProjectFormData,
    value: string | Date | undefined
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCategoryBlur = (value: string) => {
    const kebabCase = value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    setFormData((prev) => ({
      ...prev,
      category: kebabCase,
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const webpFiles = files.filter((file) => file.type === "image/webp");

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...webpFiles],
    }));
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    try {
      // Validación de campos requeridos
      if (!formData.title) {
        throw new Error("El título es requerido");
      }
      if (!formData.category) {
        throw new Error("La categoría es requerida");
      }
      if (!formData.publishDate) {
        throw new Error("La fecha de publicación es requerida");
      }
      if (!formData.images || formData.images.length === 0) {
        throw new Error("Debes subir al menos una imagen");
      }
      if (!formData.imageAlt) {
        throw new Error("El texto alternativo de la imagen es requerido");
      }
      if (!formData.description) {
        throw new Error("La descripción es requerida");
      }

      console.log("🚀 Iniciando envío del proyecto...");
      console.log("📝 Datos del formulario:", {
        title: formData.title,
        subtitle: formData.subtitle,
        category: formData.category,
        publishDate: formData.publishDate?.toISOString().split("T")[0],
        imagesCount: formData.images?.length || 0,
        imageAlt: formData.imageAlt,
        description: formData.description,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      // Convertir imágenes a base64
      console.log("🖼️ Iniciando conversión de imágenes...");
      const imagePromises = formData.images.map((file, index) => {
        console.log(`Procesando imagen ${index + 1}: ${file.name}`);
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            // Asegurarse de que la imagen sea válida antes de enviarla
            const img = new Image();
            img.onload = () => {
              console.log(`✅ Imagen ${index + 1} cargada correctamente`);
              resolve(reader.result);
            };
            img.onerror = () => {
              console.error(`❌ Error al cargar la imagen ${file.name}`);
              reject(new Error(`Error al cargar la imagen ${file.name}`));
            };
            img.src = reader.result as string;
          };
          reader.onerror = (error) => {
            console.error(`❌ Error al leer la imagen ${file.name}:`, error);
            reject(new Error(`Error al leer la imagen ${file.name}`));
          };
          reader.readAsDataURL(file);
        });
      });

      console.log("🖼️ Procesando imágenes...");
      const base64Images = await Promise.all(imagePromises);
      console.log(`✅ ${base64Images.length} imágenes procesadas`);

      // Preparar datos para la API
      const requestData = {
        title: formData.title,
        subtitle: formData.subtitle,
        category: formData.category,
        publishDate: formData.publishDate
          ? `${format(formData.publishDate, "yyyy-MM-dd")} 00:00:00`
          : "",
        images: base64Images,
        imageNames: formData.images.map((file) => file.name),
        imgAlts: Array(base64Images.length).fill(formData.imageAlt),
        description: formData.description,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      console.log("📤 Enviando datos a la API...");
      const response = await fetch("/api/create-md", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || "Error desconocido");
      }

      console.log("✅ Proyecto creado exitosamente:", result);
      alert(
        "¡Proyecto creado exitosamente! Revisa la consola para más detalles."
      );
    } catch (error: any) {
      console.error("❌ Error al crear el proyecto:", error);
      const errorMessage = error.message || "Error desconocido";
      alert(`Error: ${errorMessage}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Column */}
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Add New Project
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Enter project title"
                  />
                  <p className="text-xs text-gray-500">
                    Example: "Modern Architecture Portfolio"
                  </p>
                </div>

                {/* Subtitle */}
                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={formData.subtitle}
                    onChange={(e) =>
                      handleInputChange("subtitle", e.target.value)
                    }
                    placeholder="Enter subtitle (applies to cover image)"
                  />
                  <p className="text-xs text-gray-500">
                    Example: "A collection of contemporary designs"
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      handleInputChange("category", e.target.value)
                    }
                    onBlur={(e) => handleCategoryBlur(e.target.value)}
                    placeholder="Enter category (will be converted to kebab-case)"
                  />
                  <p className="text-xs text-gray-500">
                    Example: "Web Design" → "web-design"
                  </p>
                </div>

                {/* Publish Date */}
                <div className="space-y-2">
                  <Label>Publish Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {formData.publishDate ? (
                          format(formData.publishDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={formData.publishDate}
                        onSelect={(date) =>
                          handleInputChange("publishDate", date)
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-gray-500">
                    Example: "June 15, 2023"
                  </p>
                </div>

                {/* Images Upload */}
                <div className="space-y-2">
                  <Label htmlFor="images">Images</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input
                      id="images"
                      type="file"
                      multiple
                      accept=".webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label htmlFor="images" className="cursor-pointer">
                      <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-sm text-gray-600">
                        Click to upload .webp images or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Only .webp files are accepted
                      </p>
                    </label>
                  </div>
                </div>

                {/* Image Alt Text */}
                <div className="space-y-2">
                  <Label htmlFor="imageAlt">Image Alt Text</Label>
                  <Input
                    id="imageAlt"
                    value={formData.imageAlt}
                    onChange={(e) =>
                      handleInputChange("imageAlt", e.target.value)
                    }
                    placeholder="Alt text for all images"
                  />
                  <p className="text-xs text-gray-500">
                    Example: "Interior design of modern apartment living room"
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    placeholder="Enter description (Markdown supported)"
                    rows={6}
                  />
                  <p className="text-xs text-gray-500">
                    Example: "This project showcases **modern design** with a
                    focus on _sustainability_."
                  </p>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => handleInputChange("tags", e.target.value)}
                    placeholder="Enter tags separated by commas"
                  />
                  <p className="text-xs text-gray-500">
                    Example: "design, portfolio, architecture"
                  </p>
                </div>

                {/* Submit Button */}
                <Button onClick={handleSubmit} className="w-full" size="lg">
                  Submit Project
                </Button>
              </CardContent>
            </Card>

            {/* Image Previews */}
            {formData.images.length > 0 && (
              <Card className="mt-8">
                <CardHeader>
                  <CardTitle className="text-lg">Image Previews</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {formData.images.map((file, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={
                              URL.createObjectURL(file) || "/placeholder.svg"
                            }
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-sm px-2 py-1 rounded">
                          {index + 1}
                          {index === 0 && " (Cover)"}
                        </div>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <div className="mt-2 text-sm text-gray-600">
                          <p className="font-medium">{file.name}</p>
                          <p className="text-xs">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Markdown Preview Column */}
          <div className="sticky top-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">
                  Markdown Preview
                </CardTitle>
                <p className="text-sm text-gray-500">
                  Live preview of the Markdown file that will be generated for
                  the cover image
                </p>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <div className="absolute top-3 left-4 text-xs font-mono text-gray-400">
                    {formData.title}.md
                  </div>
                  <pre className="bg-gray-900 text-gray-100 p-8 pt-12 rounded-lg overflow-x-auto font-mono text-sm whitespace-pre-wrap">
                    <code>
                      {markdownPreview.split("\n").map((line, i) => {
                        // Simple syntax highlighting
                        if (line.startsWith("---")) {
                          return (
                            <div key={i} className="text-yellow-400">
                              {line}
                            </div>
                          );
                        } else if (line.includes(":")) {
                          const [key, ...valueParts] = line.split(":");
                          const value = valueParts.join(":");
                          return (
                            <div key={i}>
                              <span className="text-green-400">{key}:</span>
                              <span className="text-blue-300">{value}</span>
                            </div>
                          );
                        } else if (line.startsWith("  -")) {
                          return (
                            <div key={i} className="text-purple-400">
                              {line}
                            </div>
                          );
                        } else {
                          return <div key={i}>{line}</div>;
                        }
                      })}
                    </code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
