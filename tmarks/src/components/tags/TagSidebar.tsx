import { useState, useMemo } from 'react'
import { useTags, useCreateTag } from '@/hooks/useTags'
import { tagsService } from '@/services/tags'
import type { Bookmark, Tag } from '@/lib/types'
import { TagManageModal } from './TagManageModal'
import { TagItem } from './TagItem'
import { useTagFiltering } from './useTagFiltering'
import { logger } from '@/lib/logger'

interface TagSidebarProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  isLoadingBookmarks?: boolean
  bookmarks: Bookmark[]
  tagLayout: 'grid' | 'masonry'
  onTagLayoutChange: (layout: 'grid' | 'masonry') => void
  readOnly?: boolean
  availableTags?: Tag[]
  tagSortBy?: 'usage' | 'name' | 'clicks'
  onTagSortChange?: (sortBy: 'usage' | 'name' | 'clicks') => void
  searchQuery?: string  // 外部搜索关键词
  relatedTagIds?: string[] // 后端返回的相关标签ID
}

export function TagSidebar({
  selectedTags,
  onTagsChange,
  bookmarks,
  tagLayout,
  onTagLayoutChange,
  readOnly = false,
  availableTags,
  tagSortBy: externalTagSortBy,
  onTagSortChange,
  searchQuery: externalSearchQuery = '',
  relatedTagIds: serverRelatedTagIds,
}: TagSidebarProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [internalSortBy, setInternalSortBy] = useState<'usage' | 'name' | 'clicks'>('usage')

  // 使用外部传入的 sortBy 或内部状态
  const sortBy = externalTagSortBy !== undefined ? externalTagSortBy : internalSortBy
  const setSortBy = onTagSortChange || setInternalSortBy

  const { data, isLoading } = useTags({ sort: sortBy }, { enabled: !availableTags })
  const createTag = useCreateTag()

  const tags = useMemo(() => availableTags || data?.tags || [], [availableTags, data?.tags])
  const isTagLoading = availableTags ? false : isLoading

  // 使用自定义 Hook 处理标签筛选逻辑
  const { orderedTags, relatedTagIds } = useTagFiltering(
    tags,
    bookmarks,
    selectedTags,
    externalSearchQuery,
    serverRelatedTagIds // 传递后端返回的相关标签ID
  )

  const handleToggleTag = async (tagId: string) => {
    let newSelectedTags: string[]
    if (selectedTags.includes(tagId)) {
      newSelectedTags = selectedTags.filter((id) => id !== tagId)
    } else {
      newSelectedTags = [...selectedTags, tagId]
      // 增加点击计数（异步，不阻塞UI）
      if (!readOnly) {
        try {
          await tagsService.incrementClick(tagId)
        } catch (error) {
          logger.error('Failed to increment tag click count:', error)
          // 静默失败，不影响用户体验
        }
      }
    }
    onTagsChange(newSelectedTags)
  }

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    if (!newTagName.trim()) return

    try {
      await createTag.mutateAsync({ name: newTagName.trim() })
      setNewTagName('')
      setShowCreateForm(false)
    } catch (error) {
      logger.error('Failed to create tag:', error)
    }
  }


  return (
    <>
      <div className="card flex flex-col shadow-lg h-full">
        {/* 标签头部：标签 | 排序 | 显示 | 设置 | 添加 */}
        <div className="flex items-center gap-2 mb-4 sm:mb-6 flex-shrink-0">
          {/* 标签标题 */}
          <h3 className="text-base sm:text-lg font-bold text-primary flex-shrink-0">
            标签
          </h3>

          {/* 排序按钮 */}
          <button
            onClick={() => {
              if (sortBy === 'usage') {
                setSortBy('clicks')
              } else if (sortBy === 'clicks') {
                setSortBy('name')
              } else {
                setSortBy('usage')
              }
            }}
            className="btn btn-sm btn-ghost p-2 flex-shrink-0"
            title={
              sortBy === 'usage'
                ? '按书签数排序 (点击切换到按热度)'
                : sortBy === 'clicks'
                  ? '按热度排序 (点击切换到按名称)'
                  : '按名称排序 (点击切换到按书签数)'
            }
          >
            {sortBy === 'usage' ? (
              // 书签数图标 - 使用书签堆叠图标
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6" opacity="0.5" />
              </svg>
            ) : sortBy === 'clicks' ? (
              // 热度图标 - 使用火焰图标
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            ) : (
              // 名称排序图标
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            )}
          </button>

          {/* 布局切换按钮 */}
          <button
            onClick={() => onTagLayoutChange(tagLayout === 'grid' ? 'masonry' : 'grid')}
            className="btn btn-sm btn-ghost p-2 flex-shrink-0"
            title={tagLayout === 'grid' ? '网格布局 (点击切换到瀑布流)' : '瀑布流布局 (点击切换到网格)'}
          >
            {tagLayout === 'grid' ? (
              // 网格图标 - 规整的方格
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
            ) : (
              // 瀑布流图标 - 不同高度的列
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="8" rx="1" />
                <rect x="3" y="13" width="7" height="8" rx="1" />
                <rect x="14" y="3" width="7" height="12" rx="1" />
                <rect x="14" y="17" width="7" height="4" rx="1" />
              </svg>
            )}
          </button>

          {/* 右侧按钮组 */}
          {!readOnly && (
            <>
              {/* 设置按钮 */}
              <button
                onClick={() => setShowManageModal(true)}
                className="btn btn-sm btn-ghost p-2 flex-shrink-0 ml-auto"
                title="管理标签"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* 添加按钮 */}
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className={`btn btn-sm p-2 flex-shrink-0 ${
                  showCreateForm
                    ? 'btn-ghost'
                    : 'btn-ghost'
                }`}
                title={showCreateForm ? '取消' : '新建标签'}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showCreateForm ? 'rotate-45' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* 创建标签表单 */}
        {!readOnly && showCreateForm && (
          <form onSubmit={handleCreateTag} className="mb-4 sm:mb-5 animate-fade-in flex-shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1 h-10 sm:h-auto text-sm sm:text-base"
                placeholder="输入标签名称..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-sm w-10 h-10 sm:w-auto sm:h-auto touch-manipulation" disabled={createTag.isPending}>
                {createTag.isPending ? '...' : '✓'}
              </button>
            </div>
          </form>
        )}

        {/* 标签列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-1 min-h-0 overscroll-contain touch-auto">
          {isTagLoading && (
            <div className="text-center py-8 text-muted-foreground/60 text-sm">
              <svg className="animate-spin h-6 w-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              加载中...
            </div>
          )}

          {!isTagLoading && orderedTags.length === 0 && (
            <div className="text-center py-12 text-muted-foreground/60">
              <svg className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-sm">
                {externalSearchQuery
                  ? '没有找到匹配的标签'
                  : readOnly
                    ? '发布者尚未公开任何标签'
                    : '暂无标签，点击 + 创建'}
              </p>
            </div>
          )}

          {!isTagLoading && orderedTags.length > 0 && (
            <div
              className={`${tagLayout === 'masonry'
                ? 'flex flex-wrap items-start gap-2 justify-between'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 justify-center'
                }`}
            >
              {orderedTags.map((tag) => (
                <TagItem
                  key={tag.id}
                  tag={tag}
                  isSelected={selectedTags.includes(tag.id)}
                  isRelated={relatedTagIds.has(tag.id)}
                  hasSelection={selectedTags.length > 0}
                  layout={tagLayout}
                  onToggle={() => handleToggleTag(tag.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 标签管理模态框 */}
      {!readOnly && showManageModal && (
        <TagManageModal
          tags={tags}
          onClose={() => setShowManageModal(false)}
        />
      )}
    </>
  )
}

