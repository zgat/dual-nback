"use client";

import { Component, createRef } from "react";
import type { ReactNode } from "react";

type Props = { viewKey: string; children: ReactNode; instant?: boolean; sizing?: "fill" | "content" };
type View = { key: string; content: ReactNode };
type State = { current: View; previous: View | null; revision: number };

/** Retain the real outgoing view briefly, but make it inert. Game controllers
 * stay outside this surface, so a visual exit cannot prolong a running session.
 * Derived state captures the previous props before React changes its DOM. */
export class TransitionSurface extends Component<Props, State> {
  state: State = {current: {key: this.props.viewKey, content: this.props.children}, previous: null, revision: 0};
  private timer: number | null = null;
  private observer: ResizeObserver | null = null;
  private surface = createRef<HTMLDivElement>();
  private currentView = createRef<HTMLDivElement>();

  static getDerivedStateFromProps(props: Props, state: State): State {
    const changed = props.viewKey !== state.current.key;
    return {
      current: {key: props.viewKey, content: props.children},
      previous: changed ? props.instant ? null : state.current : state.previous,
      revision: state.revision + (changed ? 1 : 0),
    };
  }

  componentDidMount() { this.observeSize(); }

  componentDidUpdate(previousProps: Props, previousState: State) {
    if (previousState.revision !== this.state.revision) {
      if (this.timer !== null) window.clearTimeout(this.timer);
      this.timer = null;
      if (this.state.previous) {
        this.timer = window.setTimeout(() => { this.timer = null; this.setState({previous: null}); }, 180);
      }
      this.observeSize();
    } else if (previousProps.sizing !== this.props.sizing) this.observeSize();
  }

  componentWillUnmount() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.observer?.disconnect();
  }

  private observeSize() {
    this.observer?.disconnect();
    if (this.props.sizing !== "content" || !this.currentView.current) return;
    const measure = () => {
      if (this.surface.current && this.currentView.current) {
        this.surface.current.style.height = `${this.currentView.current.scrollHeight}px`;
      }
    };
    this.observer = new ResizeObserver(measure);
    this.observer.observe(this.currentView.current);
    measure();
  }

  render() {
    const {current, previous} = this.state;
    return (
      <div className={`transition-surface is-${this.props.sizing ?? "fill"}`} ref={this.surface}>
        {previous && <div key={previous.key} className="surface-view is-leaving" inert aria-hidden="true">{previous.content}</div>}
        <div key={current.key} className={`surface-view is-current ${this.props.instant ? "is-instant" : ""}`} ref={this.currentView}>{current.content}</div>
      </div>
    );
  }
}
