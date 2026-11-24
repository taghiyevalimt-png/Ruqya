package az.ruqya.zapis;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** 24.11: the check every 15 minutes (also with the app closed) — see Notify. */
public class NotifyJob extends JobService {
    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() {
            public void run() {
                Notify.poll(getApplicationContext());
                jobFinished(params, false);
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
