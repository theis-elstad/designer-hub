'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Upload, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  getRefCategories,
  createRefCategory,
  deleteRefCategory,
  getRefImages,
  createRefImage,
  deleteRefImage,
  getSignedUrl,
} from '@/lib/actions/jewelgen'
import { createClient } from '@/lib/supabase/client'
import { resizeImageFile } from '@/lib/image-resize'
import type { JewelGenRefCategory, JewelGenRefImage } from '@/lib/types/jewelgen'

export default function JewelGenLibraryPage() {
  const [categories, setCategories] = useState<JewelGenRefCategory[]>([])
  const [selectedParent, setSelectedParent] = useState<string | null>(null)
  const [selectedChild, setSelectedChild] = useState<string | null>(null)
  const [images, setImages] = useState<JewelGenRefImage[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingImages, setLoadingImages] = useState(false)
  const [newParentName, setNewParentName] = useState('')
  const [newChildName, setNewChildName] = useState('')
  const [addingParent, setAddingParent] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'category' | 'subcategory' | 'image'
    id: string
    name: string
  } | null>(null)

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getRefCategories()
      setCategories(cats)
      if (cats.length > 0 && !selectedParent) {
        setSelectedParent(cats[0].id)
        if (cats[0].children && cats[0].children.length > 0) {
          setSelectedChild(cats[0].children[0].id)
        }
      }
    } catch {
      toast.error('Failed to load categories')
    } finally {
      setLoadingCategories(false)
    }
  }, [selectedParent])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const loadImages = useCallback(async () => {
    if (!selectedChild) {
      setImages([])
      setImageUrls({})
      return
    }
    setLoadingImages(true)
    try {
      const imgs = await getRefImages(selectedChild)
      setImages(imgs)
      const urls: Record<string, string> = {}
      await Promise.all(
        imgs.map(async (img) => {
          try {
            urls[img.id] = await getSignedUrl(
              'jewelgen-references',
              img.storage_path
            )
          } catch {
            // skip
          }
        })
      )
      setImageUrls(urls)
    } catch {
      toast.error('Failed to load images')
    } finally {
      setLoadingImages(false)
    }
  }, [selectedChild])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  const currentParent = categories.find((c) => c.id === selectedParent)

  const handleAddParent = async () => {
    if (!newParentName.trim()) return
    setAddingParent(true)
    try {
      await createRefCategory(newParentName.trim())
      setNewParentName('')
      await loadCategories()
      toast.success('Category added')
    } catch {
      toast.error('Failed to add category')
    } finally {
      setAddingParent(false)
    }
  }

  const handleAddChild = async () => {
    if (!newChildName.trim() || !selectedParent) return
    setAddingChild(true)
    try {
      await createRefCategory(newChildName.trim(), selectedParent)
      setNewChildName('')
      await loadCategories()
      toast.success('Sub-category added')
    } catch {
      toast.error('Failed to add sub-category')
    } finally {
      setAddingChild(false)
    }
  }

  const handleDeleteParent = (id: string, name: string) => {
    setConfirmDelete({ type: 'category', id, name })
  }

  const handleDeleteChild = (id: string, name: string) => {
    setConfirmDelete({ type: 'subcategory', id, name })
  }

  const handleDeleteImage = (id: string, label: string) => {
    setConfirmDelete({ type: 'image', id, name: label })
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    const { type, id } = confirmDelete
    setConfirmDelete(null)
    try {
      if (type === 'image') {
        await deleteRefImage(id)
        setImages((prev) => prev.filter((i) => i.id !== id))
        toast.success('Image deleted')
      } else {
        await deleteRefCategory(id)
        if (type === 'category' && selectedParent === id) {
          setSelectedParent(null)
          setSelectedChild(null)
        }
        if (type === 'subcategory' && selectedChild === id) {
          setSelectedChild(null)
        }
        await loadCategories()
        toast.success(type === 'category' ? 'Category deleted' : 'Sub-category deleted')
      }
    } catch {
      toast.error(`Failed to delete ${type}`)
    }
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedChild) return

    setUploading(true)
    try {
      const resized = await resizeImageFile(file)
      const supabase = createClient()
      const path = `${selectedChild}/${Date.now()}-${file.name}`

      const { error } = await supabase.storage
        .from('jewelgen-references')
        .upload(path, resized, { contentType: resized.type })

      if (error) throw new Error(error.message)

      await createRefImage(selectedChild, path, file.name)
      await loadImages()
      toast.success('Image uploaded')
    } catch {
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (loadingCategories) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center gap-4">
        <Link href="/jewelgen/new">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Reference Library</h1>
          <p className="text-sm text-muted-foreground">
            Manage reference image categories and images.
          </p>
        </div>
      </div>

      {/* Parent categories */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Categories
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <div key={cat.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedParent(cat.id)
                  const firstChild = cat.children?.[0]
                  setSelectedChild(firstChild?.id || null)
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  selectedParent === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {cat.name}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteParent(cat.id, cat.name)}
                className="hidden rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:inline-flex"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <Input
              placeholder="New category"
              value={newParentName}
              onChange={(e) => setNewParentName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParent()}
              className="h-7 w-32 text-sm"
              disabled={addingParent}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddParent}
              disabled={addingParent || !newParentName.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-categories */}
      {currentParent && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sub-categories in {currentParent.name}
          </h2>
          <div className="flex flex-wrap gap-2">
            {currentParent.children?.map((child) => (
              <div key={child.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedChild(child.id)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    selectedChild === child.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {child.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteChild(child.id, child.name)}
                  className="hidden rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:inline-flex"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <Input
                placeholder="New sub-category"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChild()}
                className="h-6 w-28 text-xs"
                disabled={addingChild}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddChild}
                disabled={addingChild || !newChildName.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Image grid */}
      {selectedChild && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Images
            </h2>
            <label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleUploadImage}
                className="hidden"
                disabled={uploading}
              />
              <Button
                variant="outline"
                size="sm"
                asChild
                className="cursor-pointer"
              >
                <span>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload Image'}
                </span>
              </Button>
            </label>
          </div>

          {loadingImages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No images in this sub-category yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((img) => {
                const url = imageUrls[img.id]
                if (!url) return null
                return (
                  <div key={img.id} className="group relative">
                    <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                      <img
                        src={url}
                        alt={img.label || 'Reference'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id, img.label || 'this image')}
                      className="absolute -right-1.5 -top-1.5 hidden rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm group-hover:block"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {confirmDelete?.type === 'image' ? 'image' : confirmDelete?.type === 'subcategory' ? 'sub-category' : 'category'}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{confirmDelete?.name}</span>?{' '}
              {confirmDelete?.type === 'category' && 'All sub-categories and images within it will also be deleted. '}
              {confirmDelete?.type === 'subcategory' && 'All images within it will also be deleted. '}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
