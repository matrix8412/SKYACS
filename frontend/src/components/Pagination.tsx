import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { ChevronLeft, ChevronRight } from 'lucide-solid';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const Pagination: Component<PaginationProps> = (props) => {
  const start = () => props.page * props.pageSize + 1;
  const end = () => Math.min((props.page + 1) * props.pageSize, props.totalItems);

  return (
    <Show when={props.totalPages > 1}>
      <div class="flex items-center justify-between text-sm">
        <p class="text-muted">
          Showing {start()} - {end()} of {props.totalItems}
        </p>
        <div class="flex gap-2">
          <button
            onClick={() => props.onPageChange(Math.max(0, props.page - 1))}
            disabled={props.page === 0}
            class="btn btn-secondary py-1.5 px-3"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <button
            onClick={() => props.onPageChange(Math.min(props.totalPages - 1, props.page + 1))}
            disabled={props.page >= props.totalPages - 1}
            class="btn btn-secondary py-1.5 px-3"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </Show>
  );
};

export default Pagination;