"""Separate restartable worker for email delivery, billing reconciliation and cleanup."""
import signal, subprocess, sys, time
from api.config import Settings

def main():
    s=Settings();s.validate()
    if not s.smtp_host or not s.mail_from:raise SystemExit('Configure SMTP before starting the email worker.')
    stopping=False;child=None
    def stop(*_):
        nonlocal stopping
        stopping=True
        if child and child.poll() is None:child.terminate()
    signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
    schedule={'send-mail':15,'cleanup':3600}
    if s.billing_enabled:schedule['reconcile']=300
    due={name:0 for name in schedule}
    while not stopping:
        for command,interval in schedule.items():
            if stopping:break
            if time.monotonic()<due[command]:continue
            child=subprocess.Popen([sys.executable,'-m','api.cli',command])
            try:child.wait(timeout=900)
            except subprocess.TimeoutExpired:child.terminate();child.wait(timeout=30)
            if child.returncode:print('Worker task failed:',command,flush=True)
            due[command]=time.monotonic()+interval;child=None
        time.sleep(1)

if __name__=='__main__':main()
