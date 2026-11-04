"""Built-in demo assignments and student programs for presentations.

These are small hand-written teaching examples (not the ITSP/SSCD datasets).
They cover every execution status and the main similarity situations:
renamed copy, loop-restructured copy, equivalent-expression copy, a buggy
near-copy, an unrelated solution, compile error, infinite loop and crash.
"""

SUM_DESC = "Read n, then n integers. Print their sum."
SUM_TESTS = [
    ("5\n1 2 3 4 5\n", "15\n"),
    ("3\n10 20 30\n", "60\n"),
    ("1\n7\n", "7\n"),
    ("4\n-1 -2 -3 -4\n", "-10\n"),
    ("0\n", "0\n"),
]

MAX_DESC = "Read n, then n integers. Print the largest."
MAX_TESTS = [
    ("5\n3 9 2 7 1\n", "9\n"),
    ("3\n-5 -2 -9\n", "-2\n"),
    ("1\n4\n", "4\n"),
]

ALICE = """#include <stdio.h>

int main() {
    int n, i, sum = 0;
    int a[100];
    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (i = 0; i < n; i++) {
        sum += a[i];
    }
    printf("%d\\n", sum);
    return 0;
}
"""

BOB = """#include <stdio.h>

/* Program to add up numbers.
   Written by Bob. */
int main()
{
    int count, k, total = 0;   // total so far
    int nums[100];
    scanf("%d", &count);
    // read every number
    for (k = 0; k < count; k++)
    {
        scanf("%d", &nums[k]);
    }
    // now add them
    for (k = 0; k < count; k++)
    {
        total += nums[k];
    }
    printf("%d\\n", total);
    return 0;
}
"""

CAROL = """#include <stdio.h>

int main() {
    int n, i = 0, sum = 0;
    int a[100];
    scanf("%d", &n);
    while (i < n) {
        scanf("%d", &a[i]);
        i++;
    }
    i = 0;
    while (i < n) {
        sum += a[i];
        i++;
    }
    printf("%d\\n", sum);
    return 0;
}
"""

DAVE = """#include <stdio.h>
int main(){
  int n,i,sum=0;
  int a[100];
  scanf("%d",&n);
  for(i=0;i<n;i++){ scanf("%d",&a[i]); }
  for(i=0;i<n;i++){ sum = sum + a[i]; }
  printf("%d\\n",sum);
  return 0;
}
"""

ERIN = """#include <stdio.h>

int addAll(int *arr, int len) {
    if (len == 0) {
        return 0;
    }
    return arr[len - 1] + addAll(arr, len - 1);
}

int main() {
    int values[200];
    int size;
    scanf("%d", &size);
    for (int j = 0; j < size; j++) {
        scanf("%d", &values[j]);
    }
    printf("%d\\n", addAll(values, size));
    return 0;
}
"""

# Near-copy of Alice with an off-by-one bug in the summing loop.
FRANK = """#include <stdio.h>

int main() {
    int n, i, sum = 0;
    int a[100];
    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &a[i]);
    }
    for (i = 0; i < n - 1; i++) {
        sum += a[i];
    }
    printf("%d\\n", sum);
    return 0;
}
"""

# Compile error: missing semicolon.
GINA = """#include <stdio.h>

int main() {
    int n, x, running = 0;
    scanf("%d", &n)
    while (n--) {
        scanf("%d", &x);
        running += x;
    }
    printf("%d\\n", running);
    return 0;
}
"""

# Infinite loop: forgot to decrement the counter.
HANK = """#include <stdio.h>

int main() {
    int n, x, i = 0, s = 0;
    scanf("%d", &n);
    while (i < n) {
        scanf("%d", &x);
        s += x;
    }
    printf("%d\\n", s);
    return 0;
}
"""

# Runtime error: array pointer never allocated.
IVAN = """#include <stdio.h>

int main() {
    int n, i, sum = 0;
    int *a = NULL;
    scanf("%d", &n);
    for (i = 0; i < n; i++) {
        scanf("%d", &a[i]);
        sum += a[i];
    }
    printf("%d\\n", sum);
    return 0;
}
"""

JUDY = """#include <stdio.h>

long long add(long long p, long long q) {
    return p + q;
}

int main() {
    int n;
    long long acc = 0, v;
    scanf("%d", &n);
    while (n > 0) {
        scanf("%lld", &v);
        acc = add(acc, v);
        n = n - 1;
    }
    printf("%lld\\n", acc);
    return 0;
}
"""

KIRAN = """#include <stdio.h>

int main() {
    int n, i, x, best;
    scanf("%d", &n);
    scanf("%d", &best);
    for (i = 1; i < n; i++) {
        scanf("%d", &x);
        if (x > best) {
            best = x;
        }
    }
    printf("%d\\n", best);
    return 0;
}
"""

LEELA = """#include <stdio.h>

int main() {
    int count, idx, num, largest;   // largest value seen
    scanf("%d", &count);
    scanf("%d", &largest);
    for (idx = 1; idx < count; idx++) {
        scanf("%d", &num);
        if (num > largest) {
            largest = num;
        }
    }
    printf("%d\\n", largest);
    return 0;
}
"""

MANOJ = """#include <stdio.h>

int main() {
    int n, i, j, t;
    int v[100];
    scanf("%d", &n);
    for (i = 0; i < n; i++) scanf("%d", &v[i]);
    for (i = 0; i < n - 1; i++) {
        for (j = 0; j < n - 1 - i; j++) {
            if (v[j] > v[j + 1]) {
                t = v[j];
                v[j] = v[j + 1];
                v[j + 1] = t;
            }
        }
    }
    printf("%d\\n", v[n - 1]);
    return 0;
}
"""

NINA = """#include <stdio.h>

int bigger(int a, int b) {
    return a > b ? a : b;
}

int main() {
    int n, x, m;
    scanf("%d", &n);
    scanf("%d", &m);
    while (--n > 0) {
        scanf("%d", &x);
        m = bigger(m, x);
    }
    printf("%d\\n", m);
    return 0;
}
"""

INSTRUCTOR = "Prof. Instructor"

ASSIGNMENTS = [
    {
        "title": "Sum of N integers",
        "description": SUM_DESC,
        "tests": SUM_TESTS,
        "submissions": [
            ("Alice", ALICE), ("Bob", BOB), ("Carol", CAROL), ("Dave", DAVE),
            ("Erin", ERIN), ("Frank", FRANK), ("Gina", GINA), ("Hank", HANK),
            ("Ivan", IVAN), ("Judy", JUDY),
        ],
    },
    {
        "title": "Largest of N integers",
        "description": MAX_DESC,
        "tests": MAX_TESTS,
        "submissions": [("Kiran", KIRAN), ("Leela", LEELA), ("Manoj", MANOJ), ("Nina", NINA)],
    },
]

# Ready-made programs for the "Submit" page (one per execution outcome).
SAMPLES = {
    "Correct solution": ALICE,
    "Wrong answer (off-by-one)": FRANK,
    "Compilation error": GINA,
    "Infinite loop (timeout)": HANK,
    "Runtime error (crash)": IVAN,
}
