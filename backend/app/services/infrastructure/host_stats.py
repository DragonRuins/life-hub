"""
Host System Stats Service

Reads the host's /proc and /sys filesystems (mounted into the container
at /host/proc and /host/sys) to:
  - Auto-detect hardware: CPU model, core/thread count, RAM, disk, GPU
  - Collect live metrics: CPU %, RAM %, disk %, load averages, uptime

The mount path is configurable via the HOST_PROC_PATH environment variable
(defaults to '/host/proc'). The HOST_SYS_PATH variable controls /sys
(defaults to '/host/sys').

This only works for the local host where /proc and /sys are mounted into
the container. Remote hosts would need a different mechanism (agents, etc.).
"""
import os
import time
import logging

logger = logging.getLogger(__name__)

# Configurable mount points — override via env vars if needed
HOST_PROC = os.environ.get('HOST_PROC_PATH', '/host/proc')
HOST_SYS = os.environ.get('HOST_SYS_PATH', '/host/sys')


def is_available():
    """
    Check if the host's /proc is mounted and readable.

    Returns:
        bool: True if /host/proc/stat exists and is readable.
    """
    return os.path.isfile(os.path.join(HOST_PROC, 'stat'))


def detect_hardware():
    """
    Auto-detect host hardware by parsing /proc and /sys.

    Returns a dict with the following keys (any may be None if not detected):
      - cpu: str, CPU model name (e.g. "Intel Core i7-12700K")
      - cpu_cores: int, number of physical cores
      - cpu_threads: int, number of logical threads (hyperthreading)
      - ram_gb: float, total RAM in GB (rounded to 1 decimal)
      - disk_gb: float, total root filesystem capacity in GB
      - gpu: str or None, GPU model if found via /sys/class/drm

    Raises:
        RuntimeError: If /host/proc is not available.
    """
    if not is_available():
        raise RuntimeError('Host /proc not mounted — cannot detect hardware')

    result = {
        'cpu': None,
        'cpu_cores': None,
        'cpu_threads': None,
        'ram_gb': None,
        'disk_gb': None,
        'gpu': None,
    }

    # ── CPU info from /proc/cpuinfo ──────────────────────────────
    try:
        cpuinfo_path = os.path.join(HOST_PROC, 'cpuinfo')
        with open(cpuinfo_path, 'r') as f:
            cpuinfo = f.read()

        # Extract model name from the first processor entry
        model_name = None
        physical_ids = set()
        processor_count = 0

        for line in cpuinfo.splitlines():
            line = line.strip()
            if line.startswith('model name'):
                if model_name is None:
                    # "model name : Intel(R) Core(TM) i7-12700K ..."
                    model_name = line.split(':', 1)[1].strip()
            elif line.startswith('physical id'):
                physical_ids.add(line.split(':', 1)[1].strip())
            elif line.startswith('processor'):
                processor_count += 1

        result['cpu'] = model_name
        result['cpu_threads'] = processor_count

        # Physical cores: count unique physical IDs and multiply by cores per socket
        # Alternatively, count unique "core id" per "physical id"
        # Simpler: check "cpu cores" field from first entry
        for line in cpuinfo.splitlines():
            if line.strip().startswith('cpu cores'):
                cores_per_socket = int(line.split(':', 1)[1].strip())
                num_sockets = max(len(physical_ids), 1)
                result['cpu_cores'] = cores_per_socket * num_sockets
                break

    except Exception as e:
        logger.warning(f'Failed to parse /proc/cpuinfo: {e}')

    # ── RAM from /proc/meminfo ───────────────────────────────────
    try:
        meminfo_path = os.path.join(HOST_PROC, 'meminfo')
        with open(meminfo_path, 'r') as f:
            for line in f:
                if line.startswith('MemTotal:'):
                    # "MemTotal:       32768000 kB"
                    kb = int(line.split()[1])
                    result['ram_gb'] = round(kb / (1024 * 1024), 1)
                    break
    except Exception as e:
        logger.warning(f'Failed to parse /proc/meminfo: {e}')

    # ── Disk capacity from os.statvfs ────────────────────────────
    try:
        stat = os.statvfs('/')
        total_bytes = stat.f_frsize * stat.f_blocks
        result['disk_gb'] = round(total_bytes / (1024 ** 3), 1)
    except Exception as e:
        logger.warning(f'Failed to read disk stats: {e}')

    # ── GPU from /sys/class/drm (optional) ───────────────────────
    try:
        drm_path = os.path.join(HOST_SYS, 'class', 'drm')
        if os.path.isdir(drm_path):
            for entry in os.listdir(drm_path):
                # Look for card0, card1, etc.
                if not entry.startswith('card') or '-' in entry:
                    continue
                # Try reading the device's uevent for DRIVER or PCI info
                uevent_path = os.path.join(drm_path, entry, 'device', 'uevent')
                if os.path.isfile(uevent_path):
                    with open(uevent_path, 'r') as f:
                        uevent = f.read()
                    for line in uevent.splitlines():
                        if line.startswith('DRIVER='):
                            driver = line.split('=', 1)[1]
                            # Also try to get the PCI device label
                            label_path = os.path.join(drm_path, entry, 'device', 'label')
                            if os.path.isfile(label_path):
                                with open(label_path, 'r') as lf:
                                    result['gpu'] = lf.read().strip()
                            else:
                                result['gpu'] = f'{driver} (card {entry[-1]})'
                            break
                    if result['gpu']:
                        break
    except Exception as e:
        logger.warning(f'Failed to detect GPU from /sys: {e}')

    return result


def _read_cpu_times():
    """
    Read aggregate CPU times from /proc/stat.

    Returns:
        tuple: (total_time, idle_time) in jiffies, or (None, None) on error.
    """
    try:
        stat_path = os.path.join(HOST_PROC, 'stat')
        with open(stat_path, 'r') as f:
            for line in f:
                if line.startswith('cpu '):
                    # cpu  user nice system idle iowait irq softirq steal guest guest_nice
                    parts = line.split()
                    times = [int(x) for x in parts[1:]]
                    total = sum(times)
                    # idle = idle + iowait (indices 3 and 4)
                    idle = times[3] + times[4] if len(times) > 4 else times[3]
                    return total, idle
    except Exception as e:
        logger.warning(f'Failed to read /proc/stat: {e}')
    return None, None


def get_live_metrics():
    """
    Get a live snapshot of system metrics.

    This takes ~1 second because it samples /proc/stat twice to compute
    CPU utilization as a delta.

    Returns:
        dict with keys:
          - cpu_percent: float (0-100)
          - ram_percent: float (0-100)
          - ram_used_gb: float
          - ram_total_gb: float
          - disk_percent: float (0-100)
          - disk_used_gb: float
          - disk_total_gb: float
          - load_1m: float
          - load_5m: float
          - load_15m: float
          - uptime_seconds: float

    Raises:
        RuntimeError: If /host/proc is not available.
    """
    if not is_available():
        raise RuntimeError('Host /proc not mounted — cannot read metrics')

    result = {}

    # ── CPU % (two samples 1s apart) ─────────────────────────────
    total1, idle1 = _read_cpu_times()
    time.sleep(1)
    total2, idle2 = _read_cpu_times()

    if total1 is not None and total2 is not None:
        total_delta = total2 - total1
        idle_delta = idle2 - idle1
        if total_delta > 0:
            result['cpu_percent'] = round((1 - idle_delta / total_delta) * 100, 1)
        else:
            result['cpu_percent'] = 0.0
    else:
        result['cpu_percent'] = None

    # ── RAM from /proc/meminfo ───────────────────────────────────
    result.update(_read_memory())

    # ── Disk from os.statvfs ─────────────────────────────────────
    result.update(_read_disk())

    # ── Load averages from /proc/loadavg ─────────────────────────
    result.update(_read_loadavg())

    # ── Uptime from /proc/uptime ─────────────────────────────────
    result.update(_read_uptime())

    return result


def get_sync_metrics():
    """
    Get system metrics for the sync worker WITHOUT the 1-second CPU sleep.

    Returns the same dict as get_live_metrics() but with cpu_percent=None.
    The caller should compute CPU % from stored previous /proc/stat samples.

    Also returns raw CPU times for delta calculation:
      - _cpu_total: int (total jiffies)
      - _cpu_idle: int (idle jiffies)
    """
    if not is_available():
        return None

    result = {'cpu_percent': None}

    # Provide raw CPU times for the caller to compute delta
    total, idle = _read_cpu_times()
    result['_cpu_total'] = total
    result['_cpu_idle'] = idle

    result.update(_read_memory())
    result.update(_read_disk())
    result.update(_read_loadavg())

    return result


# ── Internal helpers ─────────────────────────────────────────────

def _read_memory():
    """Parse /proc/meminfo for RAM stats."""
    result = {
        'ram_percent': None,
        'ram_used_gb': None,
        'ram_total_gb': None,
    }
    try:
        meminfo_path = os.path.join(HOST_PROC, 'meminfo')
        mem_total_kb = None
        mem_available_kb = None

        with open(meminfo_path, 'r') as f:
            for line in f:
                if line.startswith('MemTotal:'):
                    mem_total_kb = int(line.split()[1])
                elif line.startswith('MemAvailable:'):
                    mem_available_kb = int(line.split()[1])
                # Stop early once we have both
                if mem_total_kb is not None and mem_available_kb is not None:
                    break

        if mem_total_kb and mem_available_kb is not None:
            used_kb = mem_total_kb - mem_available_kb
            result['ram_total_gb'] = round(mem_total_kb / (1024 * 1024), 1)
            result['ram_used_gb'] = round(used_kb / (1024 * 1024), 1)
            result['ram_percent'] = round((used_kb / mem_total_kb) * 100, 1)

    except Exception as e:
        logger.warning(f'Failed to parse /proc/meminfo: {e}')

    return result


def _read_disk():
    """Read root filesystem usage via os.statvfs."""
    result = {
        'disk_percent': None,
        'disk_used_gb': None,
        'disk_total_gb': None,
    }
    try:
        stat = os.statvfs('/')
        total = stat.f_frsize * stat.f_blocks
        free = stat.f_frsize * stat.f_bavail  # available to non-root
        used = total - free
        result['disk_total_gb'] = round(total / (1024 ** 3), 1)
        result['disk_used_gb'] = round(used / (1024 ** 3), 1)
        if total > 0:
            result['disk_percent'] = round((used / total) * 100, 1)
    except Exception as e:
        logger.warning(f'Failed to read disk stats: {e}')
    return result


def _read_loadavg():
    """Read load averages from /proc/loadavg."""
    result = {
        'load_1m': None,
        'load_5m': None,
        'load_15m': None,
    }
    try:
        loadavg_path = os.path.join(HOST_PROC, 'loadavg')
        with open(loadavg_path, 'r') as f:
            parts = f.read().strip().split()
        result['load_1m'] = float(parts[0])
        result['load_5m'] = float(parts[1])
        result['load_15m'] = float(parts[2])
    except Exception as e:
        logger.warning(f'Failed to read /proc/loadavg: {e}')
    return result


def _read_uptime():
    """Read system uptime from /proc/uptime."""
    try:
        uptime_path = os.path.join(HOST_PROC, 'uptime')
        with open(uptime_path, 'r') as f:
            parts = f.read().strip().split()
        return {'uptime_seconds': float(parts[0])}
    except Exception as e:
        logger.warning(f'Failed to read /proc/uptime: {e}')
        return {'uptime_seconds': None}
