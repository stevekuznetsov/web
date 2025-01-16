import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React, { cache } from 'react'
import { homeStatic } from '@/endpoints/seed/home-static'

import type { Page as PageType } from '@/payload-types'

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import PageClient from './page.client'
import { LivePreviewListener } from '@/components/LivePreviewListener'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const pages = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    depth: 2,
    select: {
      tenant: true,
      slug: true,
    },
  })

  const params: PathArgs[] = []
  for (const post of pages.docs) {
    if (typeof post.tenant === 'number') {
      payload.logger.error(`got number for page tenant: ${JSON.stringify(post.tenant)}`)
      continue
    }
    params.push({ center: post.tenant.slug, slug: post.slug })
  }

  return params
}

type Args = {
  params: Promise<PathArgs>
}

type PathArgs = {
  center: string
  slug?: string
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { center, slug = 'home' } = await paramsPromise
  const url = '/' + center + '/' + slug

  let page: PageType | null

  page = await queryPageBySlug({
    center: center,
    slug: slug,
  })

  // Remove this code once your website is seeded
  if (!page && slug === 'home') {
    page = homeStatic
  }

  if (!page) {
    return <PayloadRedirects url={url} />
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }): Promise<Metadata> {
  const { center, slug = 'home' } = await paramsPromise
  const page = await queryPageBySlug({
    center: center,
    slug: slug,
  })

  return generateMeta({ doc: page })
}

const queryPageBySlug = cache(async ({ center, slug }: { center: string; slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      and: [
        {
          'tenant.slug': {
            equals: center,
          },
        },
        {
          slug: {
            equals: slug,
          },
        },
      ],
    },
  })

  return result.docs?.[0] || null
})
