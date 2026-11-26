import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# Styling configuration
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_context("paper", font_scale=1.1)


def plot_similarity_matrix_heatmap(matrix, sub_ids, output_filename="similarity_matrix_heatmap.png"):
    """Plots a 2D heatmap of pairwise similarity scores."""
    fig, ax = plt.subplots(figsize=(8, 6), layout="constrained")
    sns.heatmap(matrix, xticklabels=sub_ids, yticklabels=sub_ids,
                cmap='viridis', vmin=0.0, vmax=1.0,
                cbar_kws={'label': 'Composite Score'}, ax=ax)

    ax.set_title("Pairwise Composite Similarity Matrix")
    plt.xticks(rotation=45, ha='right', fontsize=8)
    plt.yticks(rotation=0, fontsize=8)

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)


def plot_pairwise_scalability(n_vals, exec_times, output_filename="pairwise_scalability_curve.png"):
    """Plots execution time growth versus submission count N alongside theoretical P(N)."""
    fig, ax1 = plt.subplots(figsize=(8, 5), layout="constrained")
    ax2 = ax1.twinx()

    theoretical_p = [n * (n - 1) / 2 for n in n_vals]

    l1 = ax1.plot(n_vals, exec_times, 'o-', color='tab:blue', label='Execution Time')
    l2 = ax2.plot(n_vals, theoretical_p, 's--', color='tab:red', label='P(N) = N(N-1)/2')

    ax1.set(xlabel="Number of Submissions (N)", ylabel="Execution Time (s)", title="Pairwise Scalability Curve")
    ax2.set_ylabel("Theoretical Pair Count P(N)", color='tab:red')
    ax1.yaxis.label.set_color('tab:blue')

    lines = l1 + l2
    ax1.legend(lines, [l.get_label() for l in lines], loc="upper left")
    ax2.grid(False)

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)


def plot_graph_topology(t_vals, edges, comps, max_c, avg_deg, iso_nodes, output_filename="graph_threshold_topology.png"):
    """Plots 2x2 grid of graph metrics across similarity thresholds T."""
    fig, axs = plt.subplots(2, 2, figsize=(12, 8), layout="constrained")

    axs[0, 0].plot(t_vals, edges, 'o-', color='purple')
    axs[0, 0].set(title="A: Threshold vs Total Edges", xlabel="Threshold (T)", ylabel="Edges Count")

    axs[0, 1].plot(t_vals, comps, 's-', color='darkorange')
    axs[0, 1].set(title="B: Threshold vs Connected Components", xlabel="Threshold (T)", ylabel="Component Count")

    axs[1, 0].plot(t_vals, max_c, '^-', color='green')
    axs[1, 0].set(title="C: Threshold vs Max Component Size", xlabel="Threshold (T)", ylabel="Max Size (Nodes)")

    ax_d1 = axs[1, 1]
    ax_d2 = ax_d1.twinx()
    l1 = ax_d1.plot(t_vals, avg_deg, 'd-', color='blue', label='Avg Degree')
    l2 = ax_d2.plot(t_vals, iso_nodes, 'x--', color='red', label='Isolated Nodes')

    ax_d1.set(title="D: Threshold vs Avg Degree & Isolated Nodes", xlabel="Threshold (T)")
    ax_d1.set_ylabel("Average Degree", color='blue')
    ax_d2.set_ylabel("Isolated Nodes", color='red')

    lines = l1 + l2
    ax_d1.legend(lines, [l.get_label() for l in lines], loc='center right')
    ax_d2.grid(False)

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)


def plot_candidate_filtering(tl_vals, red_pct, ret_pct, output_filename="candidate_filtering_efficiency.png"):
    """Plots candidate reduction vs clone retention efficiency across length ratio thresholds T_L."""
    fig, ax1 = plt.subplots(figsize=(8, 5), layout="constrained")
    ax2 = ax1.twinx()

    l1 = ax1.plot(tl_vals, red_pct, 'o-', color='tab:blue', label='Reduction %')
    l2 = ax2.plot(tl_vals, ret_pct, 's-', color='tab:green', label='Clone Retention %')

    ax1.set(xlabel="Length Ratio Threshold (T_L)", title="Candidate Filtering Efficiency")
    ax1.set_ylabel("Reduction (%)", color='tab:blue')
    ax2.set_ylabel("Retention (%)", color='tab:green')
    ax1.set_ylim(0, 105)
    ax2.set_ylim(0, 105)

    lines = l1 + l2
    ax1.legend(lines, [l.get_label() for l in lines], loc="lower right")
    ax2.grid(False)

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)


def plot_ngram_sensitivity(n_sizes, jaccard_scores, output_filename="ngram_sensitivity_analysis.png"):
    """Plots Jaccard score decay across N-gram window sizes."""
    df = pd.DataFrame({'N-Gram Size': n_sizes, 'Jaccard Score': jaccard_scores}).set_index('N-Gram Size')

    fig, ax = plt.subplots(figsize=(8, 5), layout="constrained")
    df.plot(kind='bar', ax=ax, colormap='Set2', edgecolor='black')

    ax.set(title="Jaccard Similarity across N-Gram Sizes", ylabel="Jaccard Score", ylim=(0, 1.1))
    plt.xticks(rotation=0)

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)


def plot_zscore_distribution(scores, output_filename="zscore_distribution_outliers.png"):
    """Plots score distribution histogram and Z-score outlier boundary lines."""
    fig, ax = plt.subplots(figsize=(8, 5), layout="constrained")
    mu, sigma = float(np.mean(scores)), float(np.std(scores))

    sns.histplot(scores, kde=True, bins=30, color='skyblue', edgecolor='black', ax=ax)

    ax.axvline(mu, color='black', ls='--', label=f'Mean ({mu:.2f})')
    ax.axvline(mu + 2 * sigma, color='red', ls='--', label=f'μ + 2σ ({mu + 2*sigma:.2f})')
    ax.axvspan(mu + 2 * sigma, 1.0, color='red', alpha=0.1, label='Outlier (z > 2)')

    ax.set(xlim=(0, 1.0), xlabel="Composite Score", ylabel="Frequency", title="Z-Score Distribution")
    ax.legend(loc='upper right')

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)


def plot_explainable_breakdown(df, output_filename="explainable_metrics_breakdown.png"):
    """Plots multi-layer metric comparison across specific inspection cases."""
    fig, ax = plt.subplots(figsize=(9, 5), layout="constrained")
    sns.barplot(data=df, x='Case', y='Score', hue='Metric', palette='muted', edgecolor='black', ax=ax)

    ax.set(title="Explainable Metrics Breakdown", ylabel="Similarity Score", ylim=(0, 1.1))
    ax.legend(bbox_to_anchor=(1.02, 1), loc='upper left')

    fig.savefig(output_filename, dpi=300)
    plt.close(fig)
