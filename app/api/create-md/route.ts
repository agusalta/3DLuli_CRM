import { NextResponse } from 'next/server'
import { Octokit } from '@octokit/rest'

interface RequestBody {
  category: string
  subtitle: string
  description: string
  tags: string[]
  imageNames: string[]
  imgAlts: string[]
  publishDate: string
  title: string
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json()
    const { category, subtitle, description, tags, imageNames, imgAlts, publishDate, title } = body

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 })
    }

    if (!process.env.GITHUB_REPO || !process.env.GITHUB_BRANCH) {
      return NextResponse.json({ error: 'GitHub repository configuration missing' }, { status: 500 })
    }

    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const owner = 'agusalta'
    const repo = process.env.GITHUB_REPO
    const branch = process.env.GITHUB_BRANCH
    const basePath = 'src/content/work'
    const categoryKebab = category.toLowerCase().replace(/\s+/g, '-')
    const assetsPath = `public/assets/${categoryKebab}`

    const createdFiles: string[] = []

    // Crear un archivo Markdown para cada imagen
    for (let i = 0; i < imageNames.length; i++) {
      const imageName = imageNames[i]
      const imgAlt = imgAlts[i]
      const fileNumber = (i + 1).toString().padStart(2, '0')
      const fileName = `${title.substring(0, 2).toLowerCase()}${fileNumber}.md`
      const filePath = `${basePath}/${fileName}`
      const imageNumber = (i + 1).toString()
      const imagePath = `${assetsPath}/${imageNumber}.webp`

      const content = [
        '---',
        `title: "${i + 1}"`,
        `subtitle: "${subtitle}"`,
        `category: ${category}`,
        `date: ${publishDate}`,
        `img: ${imagePath}`,
        `img_alt: "${imgAlt}"`,
        'tags:',
        ...tags.map(tag => `  - ${tag}`),
        '---',
        '',
        description
      ].join('\n')

      try {
        // Crear el archivo Markdown
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: filePath,
          message: `Add ${fileName}`,
          content: Buffer.from(content).toString('base64'),
          branch
        })
        createdFiles.push(fileName)

        // Crear la carpeta de assets si no existe
        try {
          await octokit.repos.getContent({
            owner,
            repo,
            path: assetsPath,
            ref: branch
          })
        } catch (error) {
          // Si la carpeta no existe, la creamos
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: `${assetsPath}/.gitkeep`,
            message: `Create ${categoryKebab} assets directory`,
            content: Buffer.from('').toString('base64'),
            branch
          })
        }
      } catch (error) {
        console.error(`Error creating file ${fileName}:`, error)
        return NextResponse.json(
          { error: `Failed to create file ${fileName}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      status: 'success',
      files: createdFiles,
      assetsPath
    })
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
} 